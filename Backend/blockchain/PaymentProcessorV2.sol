// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PaymentProcessorV2 {
    struct Payment {
        address from;
        address to;
        uint256 amount;
        uint256 fee;
        string description;
        uint256 timestamp;
        bool settled;
    }

    mapping(uint256 => Payment) public payments;
    mapping(address => uint256) public balances;
    uint256 public nextPaymentId = 1;
    uint256 public feePercentage = 1;
    address public feeCollector;

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
    
    event BatchPaymentProcessed(
        address indexed from,
        uint256 totalAmount,
        uint256 recipientsCount
    );

    constructor() {
        feeCollector = msg.sender;
    }

    function sendPayment(
        address _recipient,
        uint256 _amount,
        string memory _description
    ) public payable returns (uint256) {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be > 0");
        require(msg.value >= _amount, "Insufficient payment");

        uint256 fee = (_amount * feePercentage) / 100;
        uint256 netAmount = _amount - fee;

        uint256 paymentId = nextPaymentId++;
        
        payments[paymentId] = Payment({
            from: msg.sender,
            to: _recipient,
            amount: _amount,
            fee: fee,
            description: _description,
            timestamp: block.timestamp,
            settled: false
        });

        balances[_recipient] += netAmount;
        balances[feeCollector] += fee;

        emit PaymentReceived(paymentId, msg.sender, _recipient, _amount, fee);

        return paymentId;
    }

    function batchPayment(
        address[] memory _recipients,
        uint256[] memory _amounts,
        string memory _description
    ) external payable {
        require(_recipients.length == _amounts.length, "Arrays length mismatch");
        require(_recipients.length > 0, "No recipients");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }

        require(msg.value >= totalAmount, "Insufficient payment");

        for (uint256 i = 0; i < _recipients.length; i++) {
            sendPayment(_recipients[i], _amounts[i], _description);
        }

        emit BatchPaymentProcessed(msg.sender, totalAmount, _recipients.length);
    }

    function settle(uint256 _paymentId) external {
        Payment storage payment = payments[_paymentId];
        require(msg.sender == payment.to, "Only recipient can settle");
        require(!payment.settled, "Already settled");
        require(balances[msg.sender] >= payment.amount - payment.fee, "Insufficient balance");

        uint256 amount = payment.amount - payment.fee;
        balances[msg.sender] -= amount;
        payment.settled = true;

        payable(msg.sender).transfer(amount);

        emit PaymentSettled(_paymentId, msg.sender, amount);
    }

    function withdraw(uint256 _amount) external {
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        
        balances[msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);
    }

    function getBalance(address _user) external view returns (uint256) {
        return balances[_user];
    }

    function setFeePercentage(uint256 _newFee) external {
        require(msg.sender == feeCollector, "Only owner");
        require(_newFee <= 10, "Fee too high");
        feePercentage = _newFee;
    }
}
