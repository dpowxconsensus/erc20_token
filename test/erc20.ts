import chai, { assert } from "chai";
const { ethers } = require("hardhat");
import { RouterApp } from "./../sdk";

// const BigNumber = require("bignumber.js");
const { BigNumber } = ethers;
chai.use(require("chai-bignumber")(BigNumber));

describe("ERC20 Token", function () {
  let localProvider;
  let remoteProvider;

  let localSigner;
  let remoteSigner;

  let router;
  let localGateway;
  let remoteGateway;

  let localERC20Token;
  let remoteERC20Token;

  const _intialSupply = 10000;
  const _dstGastLimit = 1000000;
  const gasLimit = 1000000;
  const LOCAL_CHAIN_ID: string = "1";
  const REMOTE_CHAIN_ID: string = "2";

  const CHAIN_TYPE: number = 0;

  before(async () => {
    router = new RouterApp();

    // local and remote signer
    [localSigner] = await ethers.getSigners();
    [remoteSigner] = await ethers.getSigners();
    localProvider = remoteProvider = localSigner.provider;

    // let's deploy core contract here
    localGateway = remoteGateway = await router.deploy(localSigner);

    const ERC20 = await ethers.getContractFactory("ERC20");

    localERC20Token = await ERC20.connect(localSigner).deploy(
      localGateway.address,
      _dstGastLimit,
      _intialSupply
    );
    await localERC20Token.deployed();

    remoteERC20Token = await ERC20.connect(localSigner).deploy(
      remoteGateway.address,
      _dstGastLimit,
      _intialSupply
    );

    await remoteERC20Token.deployed();

    // enroll remote
    await localERC20Token.setContractOnChain(
      CHAIN_TYPE,
      REMOTE_CHAIN_ID,
      remoteERC20Token.address,
      { gasLimit }
    );

    await remoteERC20Token.setContractOnChain(
      CHAIN_TYPE,
      LOCAL_CHAIN_ID,
      localERC20Token.address,
      { gasLimit }
    );
  });

  beforeEach(async function () {});

  it("gateway Setup and erc20 token deployment on two chains", () => {});

  it("cross chain token transfer", async function () {
    // _intialSupply should be minted to localSigner
    const expectedBalance = await BigNumber.from("10000000000000000000000");

    assert(
      await localERC20Token.balanceOf(localSigner.address),
      expectedBalance
    );

    const expiryDurationInSeconds = 0; // for infinity
    const destGasPrice = await remoteProvider.getGasPrice();
    const to = localSigner.address;
    const amount = 100;
    const tx = await localERC20Token
      .connect(localSigner)
      .transferCrossChain(
        CHAIN_TYPE,
        REMOTE_CHAIN_ID,
        expiryDurationInSeconds,
        destGasPrice,
        to,
        amount,
        {
          gasPrice: await localProvider.getGasPrice(),
          gasLimit,
        }
      );
    await tx.wait();
    await router.processOutbound(localGateway);

    // on src chain contract, balance of sender should be decreased by amount
    assert(
      await localERC20Token.balanceOf(localSigner.address),
      expectedBalance.sub(amount)
    );

    // on remote contract, balance of receipent should be increased by amount
    assert(await remoteERC20Token.balanceOf(to), expectedBalance.add(amount));
  });
});
