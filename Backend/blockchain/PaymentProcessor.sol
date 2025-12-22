// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * PaymentProcessor.sol
 * 
 * Smart contract pentru procesarea plăților în rețea
 * - Automatic payment settlement
 * - Fee management
 * - Payment routing
 */

contract PaymentProcessor {
    
    struct PaymentRecord {
        address from;
        address to;
        uint256 amount;
        string description;
        uint256 timestamp;
        bool settled;
    }

    // Fee percentage (e.g., 100 = 1%)
    uint256 public feePercentage = 100; // 1%
    address public feeCollector;

    mapping(address => uint256) public balances;
    mapping(uint256 => PaymentRecord) public paymentRecords;
    uint256 public paymentCounter = 0;

    event PaymentReceived(
        uint256 indexed paymentId,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee
    );

    event PaymentSettled(
        uint256 indexed paymentId,
        address indexed recipient,
        uint256 amount
    );

    event Withdrawal(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );

    modifier onlyFeeCollector() {
        require(msg.sender == feeCollector, "Only fee collector");
        _;
    }

    constructor() {
        feeCollector = msg.sender;
    }

    /**
     * Trimite plată cu fee automatic
     */
    function sendPayment(
        address recipient,
        uint256 amount,
        string memory description
    ) public payable returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(msg.value >= amount, "Insufficient funds");
        require(amount > 0, "Amount must be > 0");

        uint256 fee = calculateFee(amount);
        uint256 netAmount = amount - fee;

        uint256 paymentId = paymentCounter++;

        paymentRecords[paymentId] = PaymentRecord({
            from: msg.sender,
            to: recipient,
            amount: netAmount,
            description: description,
            timestamp: block.timestamp,
            settled: false
        });

        // Add to balances
        balances[recipient] += netAmount;
        balances[feeCollector] += fee;

        emit PaymentReceived(paymentId, msg.sender, recipient, netAmount, fee);

        return paymentId;
    }

    /**
     * Batch payments
     */
    function batchPayment(
        address[] memory recipients,
        uint256[] memory amounts,
        string memory description
    ) public payable {
        require(recipients.length == amounts.length, "Array length mismatch");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(msg.value >= totalAmount, "Insufficient funds for batch");

        for (uint256 i = 0; i < recipients.length; i++) {
            sendPayment(recipients[i], amounts[i], description);
        }
    }

    /**
     * Calculează fee
     */
    function calculateFee(uint256 amount) public view returns (uint256) {
        return (amount * feePercentage) / 10000;
    }

    /**
     * Settle payment (renter aprobă)
     */
    function settlePayment(uint256 paymentId) public {
        require(paymentId < paymentCounter, "Payment not found");
        PaymentRecord storage record = paymentRecords[paymentId];
        
        require(record.to == msg.sender, "Only recipient can settle");
        require(!record.settled, "Already settled");

        record.settled = true;
        emit PaymentSettled(paymentId, record.to, record.amount);
    }

    /**
     * Retrage balance
     */
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit Withdrawal(msg.sender, amount, block.timestamp);
    }

    /**
     * Obține user balance
     */
    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }

    /**
     * Obține payment record
     */
    function getPaymentRecord(uint256 paymentId) public view returns (PaymentRecord memory) {
        require(paymentId < paymentCounter, "Payment not found");
        return paymentRecords[paymentId];
    }

    /**
     * Set fee percentage (owner only)
     */
    function setFeePercentage(uint256 newFee) public onlyFeeCollector {
        require(newFee <= 500, "Fee too high (max 5%)");
        feePercentage = newFee;
    }

    /**
     * Emergency withdrawal (owner only)
     */
    function emergencyWithdraw() public onlyFeeCollector {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(feeCollector).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    // Fallback
    receive() external payable {}
}
