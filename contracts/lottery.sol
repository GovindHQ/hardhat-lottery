//SPDX-License-Identifier:MIT

//Enter the lottery(paying some amount)
//pick a random winner(verifiably random)
//winner to be selected every x minutes -> completely automated

//Chain link oracle -> randomness, automation execution(chainlink keeper)

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol"; //we have to yarn add --dev @chainlink/contracts, so we can import from our local dev
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Lottery__NotEnoughEthEntered();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__UpKeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 lotteryState
);

/**
 * @title A sample lottery contract
 * @author Govind P Nair
 * @notice this contract is for creating an untamperable decentralised smart contract
 */

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
    enum LotteryState {
        //A NEW TYPE IS CREATED HERE
        OPEN,
        CALCULATING
    }

    uint256 private immutable i_entrancefee;
    address payable[] private s_players; //it is in payable cause we may need to pay the winner
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    address private s_recentWinner;
    LotteryState private s_LotteryState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    event LotteryEnter(address indexed player);
    event RequestedLotteryWinner(uint indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2, //contract address
        uint256 entrancefee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entrancefee = entrancefee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_LotteryState = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function checkUpkeep(
        bytes memory /* checkdata*/
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /*performData*/)
    {
        //override becasue it is in virtual in keepercompatibleinterface
        bool isOpen = s_LotteryState == LotteryState.OPEN;
        // block.timestamp - to check time, solidity global varibales
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        return (upkeepNeeded, "0x0"); //- idk why the test was not properly running when this was not commented out
    }

    //request the random number
    //once we get it, do something with it
    //2 transaction process

    function performUpkeep(bytes calldata /*performData*/) external override {
        //requestRandomWords

        //this function will be automatically run by the chainlink keepers

        //requestRandomWords function will return a requestId which we will emit as an event
        (bool upKeepNeeded, ) = checkUpkeep("");

        if (!upKeepNeeded) {
            revert Lottery__UpKeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_LotteryState)
            );
        }
        s_LotteryState = LotteryState.CALCULATING;

        uint256 requestId = i_vrfCoordinator.requestRandomWords( // we saw the sample contract and made this our own, refer to chainlink doc sample contract
            i_gasLane, //gasLane
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedLotteryWinner(requestId);
    }

    /**
     * @dev
     they look for the upKeedNeeded to return true.
     the following should be true in order to return true.
     1.Out time interval should have passed
     2.the lottery should have atleast 1 player, and have some eth.
     3.our subcription is funded with link.
     4. the lottery should be in "open" state. it will be closed when it is waiting for the random number to return or in the calculating state.
     */

    function fulfillRandomWords(
        uint256 /*requestId*/,
        uint256[] memory randomWords
    ) internal override {
        //the original function in vrfconsumerbase is virtual, we use the overide keyword to overide it
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_LotteryState = LotteryState.OPEN;
        s_players = new address payable[](0); //reseting the players array
        s_lastTimeStamp = block.timestamp; //updating the timestamp

        (bool success, ) = recentWinner.call{value: address(this).balance}("");

        if (!success) {
            revert Lottery__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    function enterLottery() public payable {
        if (msg.value < i_entrancefee) {
            revert Lottery__NotEnoughEthEntered();
        }
        if (s_LotteryState == LotteryState.OPEN) {
            s_players.push(payable(msg.sender)); //typecasting msg.sender cause s_player stores only payable addresses
        } else {
            revert Lottery__NotOpen();
        }

        //emit an event when we update a dynamic array or mapping
        //name events with the function name reversed
        emit LotteryEnter(msg.sender);
    }

    /*view / pure functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entrancefee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getLotteryState() public view returns (uint256) {
        return uint256(s_LotteryState);
    }

    function getNumWords() public pure returns (uint256) {
        //i did pure cause it had swiggly lines. cause num_words is a constant variable
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        //pure cause it returns a constant variable
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
