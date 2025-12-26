// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract StorageContractV2 {
    struct StorageAgreement {
        address renter;
        address provider;
        uint256 allocatedGB;
        uint256 usedGB;
        uint256 pricePerGBPerMonth;
        uint256 durationMonths;
        uint256 totalCost;
        uint256 escrowBalance;
        uint256 createdAt;
        uint256 expiresAt;
        bool active;
        bool fulfilled;
    }

    mapping(uint256 => StorageAgreement) public agreements;
    uint256 public nextAgreementId = 1;
    
    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed renter,
        address indexed provider,
        uint256 allocatedGB,
        uint256 totalCost
    );
    
    event EscrowDeposited(
        uint256 indexed agreementId,
        address indexed depositor,
        uint256 amount
    );
    
    event PaymentProcessed(
        uint256 indexed agreementId,
        address indexed from,
        address indexed to,
        uint256 amount
    );
    
    event StorageUsageUpdated(
        uint256 indexed agreementId,
        uint256 oldUsage,
        uint256 newUsage
    );
    
    event AgreementFulfilled(
        uint256 indexed agreementId
    );

    function createAgreement(
        address _provider,
        uint256 _allocatedGB,
        uint256 _pricePerGBPerMonth,
        uint256 _durationMonths
    ) external payable returns (uint256) {
        require(_provider != address(0), "Invalid provider");
        require(_allocatedGB > 0, "Allocated GB must be > 0");
        require(_pricePerGBPerMonth > 0, "Price must be > 0");
        require(_durationMonths > 0, "Duration must be > 0");

        uint256 totalCost = _allocatedGB * _pricePerGBPerMonth * _durationMonths;
        require(msg.value >= totalCost, "Insufficient escrow");

        uint256 agreementId = nextAgreementId++;
        
        agreements[agreementId] = StorageAgreement({
            renter: msg.sender,
            provider: _provider,
            allocatedGB: _allocatedGB,
            usedGB: 0,
            pricePerGBPerMonth: _pricePerGBPerMonth,
            durationMonths: _durationMonths,
            totalCost: totalCost,
            escrowBalance: msg.value,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + (_durationMonths * 30 days),
            active: true,
            fulfilled: false
        });

        emit AgreementCreated(agreementId, msg.sender, _provider, _allocatedGB, totalCost);
        emit EscrowDeposited(agreementId, msg.sender, msg.value);

        return agreementId;
    }

    function depositEscrow(uint256 _agreementId) external payable {
        StorageAgreement storage agreement = agreements[_agreementId];
        require(agreement.active, "Agreement not active");
        require(msg.sender == agreement.renter, "Only renter can deposit");

        agreement.escrowBalance += msg.value;
        emit EscrowDeposited(_agreementId, msg.sender, msg.value);
    }

    function processPayment(uint256 _agreementId) external {
        StorageAgreement storage agreement = agreements[_agreementId];
        require(agreement.active, "Agreement not active");
        require(block.timestamp < agreement.expiresAt, "Agreement expired");

        uint256 monthlyPayment = calculateMonthlyPayment(_agreementId);
        require(agreement.escrowBalance >= monthlyPayment, "Insufficient escrow");

        agreement.escrowBalance -= monthlyPayment;
        payable(agreement.provider).transfer(monthlyPayment);

        emit PaymentProcessed(_agreementId, agreement.renter, agreement.provider, monthlyPayment);

        if (agreement.escrowBalance == 0 || block.timestamp >= agreement.expiresAt) {
            agreement.active = false;
            agreement.fulfilled = true;
            emit AgreementFulfilled(_agreementId);
        }
    }

    function calculateMonthlyPayment(uint256 _agreementId) public view returns (uint256) {
        StorageAgreement storage agreement = agreements[_agreementId];
        
        uint256 payment = agreement.allocatedGB * agreement.pricePerGBPerMonth;
        
        return payment;
    }

    function updateStorageUsage(uint256 _agreementId, uint256 _newUsedGB) external {
        StorageAgreement storage agreement = agreements[_agreementId];
        require(agreement.active, "Agreement not active");
        require(msg.sender == agreement.provider, "Only provider can update");
        require(_newUsedGB <= agreement.allocatedGB, "Usage exceeds allocation");

        uint256 oldUsage = agreement.usedGB;
        agreement.usedGB = _newUsedGB;

        emit StorageUsageUpdated(_agreementId, oldUsage, _newUsedGB);
    }

    function getAgreement(uint256 _agreementId) external view returns (
        address renter,
        address provider,
        uint256 allocatedGB,
        uint256 usedGB,
        uint256 pricePerGBPerMonth,
        uint256 escrowBalance,
        bool active,
        bool fulfilled
    ) {
        StorageAgreement storage agreement = agreements[_agreementId];
        return (
            agreement.renter,
            agreement.provider,
            agreement.allocatedGB,
            agreement.usedGB,
            agreement.pricePerGBPerMonth,
            agreement.escrowBalance,
            agreement.active,
            agreement.fulfilled
        );
    }

    function withdrawEscrow(uint256 _agreementId) external {
        StorageAgreement storage agreement = agreements[_agreementId];
        require(msg.sender == agreement.renter, "Only renter can withdraw");
        require(!agreement.active, "Agreement still active");
        require(agreement.escrowBalance > 0, "No funds to withdraw");

        uint256 amount = agreement.escrowBalance;
        agreement.escrowBalance = 0;
        
        payable(msg.sender).transfer(amount);
    }
}
