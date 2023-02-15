// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "./IERC20.sol";

import "evm-gateway-contract/contracts/ICrossTalkApplication.sol";
import "evm-gateway-contract/contracts/Utils.sol";
import "evm-gateway-contract/contracts/IGateway.sol";

contract ERC20 is IERC20, ICrossTalkApplication {
    // events for crosstalk
    event sent(
        address sender,
        address recipient,
        string _srcChainId,
        uint256 amount
    );
    event received(
        address sender,
        address recipient,
        string dstId,
        uint256 amount
    );

    uint public totalSupply;
    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;
    string public name = "Solidity by Example";
    string public symbol = "SOLBYEX";
    uint8 public decimals = 18;

    address owner;
    address public gatewayContract;
    uint64 public destGasLimit;
    mapping(uint64 => mapping(string => bytes)) public ourContractOnChains;

    constructor(
        address payable gatewayAddress,
        uint64 _destGasLimit,
        uint256 _initialSupply
    ) {
        gatewayContract = gatewayAddress;
        destGasLimit = _destGasLimit;
        owner = msg.sender;
        _mint(msg.sender, _initialSupply * 10 ** decimals);
    }

    function transfer(address recipient, uint amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    function approve(address spender, uint amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint amount
    ) external returns (bool) {
        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
        return true;
    }

    function mint(uint amount) external {
        balanceOf[msg.sender] += amount;
        totalSupply += amount;
        emit Transfer(address(0), msg.sender, amount);
    }

    function burn(uint amount) external {
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    // cross chain functions
    modifier onlyOwner() {
        require(owner == msg.sender, "Caller is not owner");
        _;
    }

    /*
        mapping remote contract on src contract
    */
    function setContractOnChain(
        uint64 chainType,
        string memory chainId,
        address contractAddress
    ) external onlyOwner {
        ourContractOnChains[chainType][chainId] = toBytes(contractAddress);
    }

    function _mint(address recipient, uint256 amount) internal {
        balanceOf[recipient] += amount;
        totalSupply += amount;
    }

    function _burn(address sender, uint256 amount) internal {
        require(balanceOf[sender] >= amount, "Insufficient balance");
        balanceOf[sender] -= amount;
        totalSupply -= amount;
    }

    function transferCrossChain(
        uint64 _dstChainType,
        string memory _dstChainId, // it can be uint, why it is string?
        uint64 expiryTimestamp,
        uint64 destGasPrice,
        address recipient,
        uint256 amount
    ) public {
        bytes memory payload = abi.encode(amount, recipient, msg.sender);

        // burn token on src chain from msg.msg.sender
        _burn(msg.sender, amount);

        if (expiryTimestamp == 0) {
            expiryTimestamp = type(uint64).max;
        }

        bytes[] memory addresses = new bytes[](1);
        addresses[0] = ourContractOnChains[_dstChainType][_dstChainId];
        bytes[] memory payloads = new bytes[](1);
        payloads[0] = payload;

        IGateway(gatewayContract).requestToDest(
            Utils.RequestArgs(expiryTimestamp, false, Utils.FeePayer.USER),
            Utils.AckType(Utils.AckType.NO_ACK),
            Utils.AckGasParams(destGasLimit, destGasPrice),
            Utils.DestinationChainParams(
                destGasLimit,
                destGasPrice,
                _dstChainType,
                _dstChainId
            ),
            Utils.ContractCalls(payloads, addresses)
        );

        emit sent(msg.sender, recipient, _dstChainId, amount);
    }

    // mint amount to receipent
    function handleRequestFromSource(
        bytes memory srcContractAddress,
        bytes memory payload,
        string memory srcChainId,
        uint64 srcChainType
    ) external returns (bytes memory) {
        require(msg.sender == gatewayContract, "Caller is not gateway");
        require(
            keccak256(srcContractAddress) ==
                keccak256(ourContractOnChains[srcChainType][srcChainId]),
            "Invalid src chain"
        );
        (uint256 amount, address recipient, address sender) = abi.decode(
            payload,
            (uint256, address, address)
        );

        _mint(recipient, amount);

        emit received(sender, recipient, srcChainId, amount);
        return abi.encode(srcChainId, srcChainType);
    }

    function toBytes(address a) public pure returns (bytes memory b) {
        assembly {
            let m := mload(0x40)
            a := and(a, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            mstore(
                add(m, 20),
                xor(0x140000000000000000000000000000000000000000, a)
            )
            mstore(0x40, add(m, 52))
            b := m
        }
    }

    // without any ack
    function handleCrossTalkAck(
        uint64, // eventIdentifier
        bool[] memory, // execFlags
        bytes[] memory // execData
    ) external {}
}
