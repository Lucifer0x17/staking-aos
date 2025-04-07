import assert from "assert"
import { describe, it, before } from "node:test"
import path from "path"
import { AO, acc } from "wao/test"
import fs from 'fs'


describe("Staking proceess Tests", function () {
  let ao
  let tokenProcess, tokenPid
  let stakingProcess, stakingPid

  let alice, bob, charlie

  const CooldownPeriod = 30 * 24 * 60 * 60 // 30 days in seconds (used for time advancement)
  const MinimumStake = "10000000000000" // 10 tokens (from staking.lua)
  const SlashVotingPeriod = 7 * 24 * 60 * 60 // 7 days voting period
  const TokenSupply = "10000000000000000" // 10000 tokens
  const TestTokenTransfer = "500000000000000" // 500 Tokens

  before(async () => {
    console.log("\x1b[33m== Setting up test environment ==\x1b[0m");
    try {
      ao = await new AO().init(acc[0])

      alice = acc[0]
      bob = acc[1]
      charlie = acc[2]



      // Read process source code
      const srcDir = path.resolve(".", "..", "src")
      const tokenSrc = fs.readFileSync(path.join(srcDir, "token.lua"), "utf8")
      const stakingSrc = fs.readFileSync(path.join(srcDir, "staking.lua"), "utf8")

      console.log("\x1b[36mDeploying token process...\x1b[0m")
      // Deploy token process with alice as the owner
      const { p: tokenProc, pid: tPid } = await ao.deploy({
        src_data: tokenSrc,
        signer: alice
      })
      tokenProcess = tokenProc
      tokenPid = tPid
      console.log("\x1b[36mToken process deployed with PID:\x1b[0m", tokenPid)

      console.log("\x1b[36mDeploying staking process...\x1b[0m")
      // Deploy staking process
      const { p: stakingProc, pid: sPid } = await ao.deploy({
        src_data: stakingSrc,
        signer: alice
      })
      stakingProcess = stakingProc
      stakingPid = sPid
      console.log("\x1b[36mStaking process deployed with PID:\x1b[0m", stakingPid)

      console.log("\x1b[36mConfiguring staking process...\x1b[0m")
      // Set the token process id in the staking process
      await ao.msg({ pid: stakingPid, act: "Eval", data: `TokenProcess="${tokenPid}"` })

      // Check if the token process id is set in the staking process
      const TokenState = await ao.msg({ pid: stakingPid, act: "Eval", data: `TokenProcess` })
      assert.equal(TokenState.res.Output.data, tokenPid, "Token process id should be set in staking process")

      // Check for token supply
      console.log("\x1b[36mChecking Token Supply...\x1b[0m")

      // Check Token balance of process
      const { out: tokenBalance } = await tokenProcess.msg("Balance", { Recipient: tokenPid })
      assert.equal(tokenBalance.toString(), TokenSupply, "\x1b[31mTokens were not minted\x1b[0m")
      console.log("\x1b[33m== Setting up Completed ==\x1b[0m");

    } catch (error) {
      console.log("\x1b[31mError during setup:\x1b[0m", error.message)
    }
  })

  describe("Token Operations", function () {
    it("should transfer tokens to alice, bob, and charlie", async () => {
      try {
        console.log("\x1b[36mTransferring Tokens to respective addresses...\x1b[0m")
        // Transfer tokens to alice
        await ao.msg({ pid: tokenPid, act: "Eval", data: `Send({Target=ao.id, Action="Transfer", Recipient="${alice.addr}", Quantity="${TestTokenTransfer}" })` })
        // Transfer tokens to bob
        await ao.msg({ pid: tokenPid, act: "Eval", data: `Send({Target=ao.id, Action="Transfer", Recipient="${bob.addr}", Quantity="${TestTokenTransfer}" })` })
        // Transfer tokens to charlie
        await ao.msg({ pid: tokenPid, act: "Eval", data: `Send({Target=ao.id, Action="Transfer", Recipient="${charlie.addr}", Quantity="${TestTokenTransfer}" })` })
      } catch (error) {
        console.error(`\x1b[31mTransaction failed: ${error.message}\x1b[0m`);
        ;
      }
    })

    it("should allow checking balances", async () => {
      try {
        console.log("\x1b[36mVerifying Token Balances...\x1b[0m")
        const { out: balancesArray } = await tokenProcess.msg("Balances")
        // Check Token balance of Alice
        assert.equal(balancesArray[alice.addr], TestTokenTransfer, "Alice did not receive the expected tokens")
        // Check Token balance of Bob
        assert.equal(balancesArray[bob.addr], TestTokenTransfer, "Bob did not receive the expected tokens")
        // Check Token balance of Charlie
        assert.equal(balancesArray[charlie.addr], TestTokenTransfer, "Charlie did not receive the expected tokens")
      } catch (error) {
        console.error(`\x1b[31m${error.message}\x1b[0m`)

      }
    })
  })

  describe("Staking Handler Tests", function () {
    // Tests for the stake handler
    it("should successfully stake tokens with valid amount", async () => {
      try {

        // First, approve the staking contract to spend tokens
        const stakeAmount = MinimumStake

        // Need to transfer tokens from bob to staking process
        const msg = await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: stakeAmount,
          "X-Action": "Stake"
        }, { jwk: bob.jwk })

        // Verify the staking was successful by checking the stake data
        const bobStakeInfo = (await stakingProcess.v("Stakes"))[bob.addr]

        // Check that the stake was recorded correctly
        assert.equal(bobStakeInfo.amount, stakeAmount, "\x1b[31mStake amount not recorded correctly\x1b[0m")
        assert.equal(bobStakeInfo.status, "STAKED", "\x1b[31mStake status should be STAKED\x1b[0m")
        assert.notEqual(bobStakeInfo.stakeTime, 0, "\x1b[31mStake time should be recorded\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mStaking test failed: ${error.message}\x1b[0m`)

      }
    })

    it("should fail to stake less than minimum amount", async () => {
      try {
        // Create an amount less than minimum
        const insufficientAmount = "1000000000000" // 1 token, below minimum of 10

        // Attempt to stake an insufficient amount
        const { mid } = await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: insufficientAmount,
          "X-Action": "Stake"
        }, { jwk: charlie.jwk })
        const { out } = await tokenProcess.res({ mid, get: ["Quantity", "Action"] })
        assert.equal(out.Quantity, insufficientAmount.toString(), "\x1b[31mStake amount not returned correctly\x1b[0m")
        assert.equal(out.Action, "Debit-Notice", "\x1b[31mWrong tag is sending the money\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);
        ;
      }
    })

    it("should update stake amount when staking more tokens", async () => {
      try {

        // First, get bob's current stake
        const initialStakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const initialStake = initialStakeResult.out
        const initialAmount = initialStake.stake.amount

        // Stake additional tokens
        const additionalAmount = MinimumStake
        await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: additionalAmount,
          "X-Action": "Stake"
        }, { jwk: bob.jwk })

        // Check that stake was updated correctly
        const updatedStakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const updatedStake = updatedStakeResult.out

        // Expected amount is initialAmount + additionalAmount
        const expectedAmount = (BigInt(initialAmount) + BigInt(additionalAmount)).toString()

        assert.equal(updatedStake.stake.amount, expectedAmount, "\x1b[31mStake amount not updated correctly\x1b[0m")
      } catch (error) {
        console.error(`\x1b[31mUpdating stake test failed: ${error.message}\x1b[0m`)

      }
    })

    it("should allow multiple users to stake tokens", async () => {
      try {
        // Alice stakes tokens
        const stakeAmount = MinimumStake
        await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: stakeAmount,
          "X-Action": "Stake"
        }, { jwk: alice.jwk })

        // Charlie stakes tokens
        await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: stakeAmount,
          "X-Action": "Stake"
        }, { jwk: charlie.jwk })

        // Verify both users have active stakes
        const aliceStakeResult = await stakingProcess.msg("View-Stake", { Target: alice.addr })
        const charlieStakeResult = await stakingProcess.msg("View-Stake", { Target: charlie.addr })

        const aliceStake = aliceStakeResult.out
        const charlieStake = charlieStakeResult.out

        assert.equal(aliceStake.stake.amount, stakeAmount, "\x1b[31mAlice's stake amount incorrect\x1b[0m")
        assert.equal(charlieStake.stake.amount, stakeAmount, "\x1b[31mCharlie's stake amount incorrect\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mMultiple user staking test failed: ${error.message}\x1b[0m`)

      }
    })

    it("should allow viewing all stakes", async () => {
      try {

        // Get all stakes
        const allStakesResult = await stakingProcess.msg("View-All-Stakes")
        const allStakes = allStakesResult.out

        // Verify that all three users have stakes
        assert(allStakes[alice.addr], "\x1b[31mAlice's stake not found\x1b[0m")
        assert(allStakes[bob.addr], "\x1b[31mBob's stake not found\x1b[0m")
        assert(allStakes[charlie.addr], "\x1b[31mCharlie's stake not found\x1b[0m")
      } catch (error) {
        console.error(`\x1b[31mView all stakes test failed: ${error.message}\x1b[0m`)

      }
    })
  })

  describe("Unstake Handler Tests", function () {
    it("should successfully initiate unstake and start cooldown", async () => {
      try {

        // First verify bob has an active stake
        const initialStakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const initialStake = initialStakeResult.out
        assert.equal(initialStake.stake.status, "STAKED", "\x1b[31mBob's stake should be active before unstaking\x1b[0m")
        // Initiate unstake
        const { out: unstakeResult } = await stakingProcess.msg("Unstake", {}, { get: { Data: { data: true, json: true }, Action: "Action" }, jwk: bob.jwk })

        // Verify the response data
        assert(unstakeResult.Data, "\x1b[31mUnstake response should contain data\x1b[0m")
        assert(unstakeResult.Action === "Unstake-Initiated", "\x1b[31mAction should be Unstake-Initiated\x1b[0m")

        // Verify cooldown has started
        const updatedStakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const updatedStake = updatedStakeResult.out

        assert.equal(updatedStake.stake.status, "IN_COOLDOWN", "\x1b[31mStake status should be IN_COOLDOWN\x1b[0m")
        assert.notEqual(updatedStake.stake.cooldownStart, 0, "\x1b[31mCooldown start time should be recorded\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mUnstake test failed: ${error.message}\x1b[0m`)

      }
    })

    it("should fail to unstake when there is no active stake", async () => {
      try {
        const ar = ao.ar
        const { jwk } = await ar.gen("1")

        // Attempt to unstake with no active stake
        const { res } = await stakingProcess.msg("Unstake", { jwk: jwk })
        assert(res.Error.includes("No active stake found"), "\x1b[31mUnstake response should contain error\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`)

      }
    })

    it("should fail to unstake again when already in cooldown", async () => {
      try {
        // Attempt to unstake with no active stake
        const { res } = await stakingProcess.msg("Unstake", { jwk: bob.jwk })
        assert(res.Error.includes("Stake is already in cooldown"), "\x1b[31mUnstake response should contain error\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`)

      }
    })

    it("should show correct time remaining for cooldown", async () => {
      try {

        // Get bob's stake with cooldown info
        const stakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const stake = stakeResult.out
        // Verify cooldown period is set correctly
        assert(stake.timeRemaining > 0, "\x1b[31mCooldown time remaining should be greater than 0\x1b[0m")
        assert.equal(stake.canWithdraw, false, "\x1b[31mShould not be able to withdraw yet\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`)

      }
    })
  })

  describe("Withdraw Handler Tests", function () {
    it("should fail to withdraw before cooldown period completes", async () => {
      try {

        // Attempt to withdraw before cooldown completes
        const { res } = await stakingProcess.msg("Withdraw", {}, { jwk: bob.jwk })

        // Check that the withdrawal was rejected
        assert(res.Error.includes("Cooldown period not completed"), "\x1b[31mWithdraw should fail when cooldown period not completed\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`)

      }
    })

    it("should fail to withdraw when not in cooldown", async () => {
      try {

        // Alice has staked but not initiated unstake
        const { res } = await stakingProcess.msg("Withdraw", {}, { jwk: alice.jwk })

        // Check that the withdrawal was rejected
        assert(res.Error.includes("unstake first to wirhdraw"), "\x1b[31mWithdraw should fail when not in cooldown\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`)

      }
    })

    it("should successfully withdraw after cooldown period", async () => {
      try {

        // Get Bob's initial token balance
        const { out: initialBalance } = await tokenProcess.msg("Balance", { Recipient: bob.addr })

        // Get Bob's stake amount
        const bobStakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const bobStake = bobStakeResult.out
        const stakeAmount = bobStake.stake.amount

        // Reduce cooldown period to mock test
        await ao.msg({ pid: stakingPid, act: "Eval", data: `CooldownPeriod = 1` })

        // Check that cooldown is complete
        const afterTimeSkipResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const afterTimeSkip = afterTimeSkipResult.out
        assert.equal(afterTimeSkip.canWithdraw, true, "\x1b[31mShould be able to withdraw after cooldown\x1b[0m")

        // Execute withdrawal
        const { out: withdrawResult } = await stakingProcess.msg("Withdraw", {}, {
          get: { Data: { data: true, json: true }, Action: "Action" },
          check: { Action: "Withdraw-Success" },
          jwk: bob.jwk,
          timeout: 5000
        })

        // Verify withdraw success
        assert.equal(withdrawResult.Action, "Withdraw-Success", "\x1b[31mWithdraw action should be successful\x1b[0m")
        assert.equal(withdrawResult.Data.amount, stakeAmount, "\x1b[31mWithdraw amount differs from stake amount\x1b[0m")

        // Check that stake was reset
        const finalStakeResult = await stakingProcess.msg("View-Stake", { Target: bob.addr })
        const finalStake = finalStakeResult.out
        assert.equal(finalStake.stake.amount, "0", "\x1b[31mStake amount should be reset to 0\x1b[0m")
        assert.equal(finalStake.stake.status, "STAKED", "\x1b[31mStake status should be reset to STAKED\x1b[0m")

        // Check that tokens were returned to bob
        const { out: finalBalance } = await tokenProcess.msg("Balance", { Recipient: bob.addr })
        const expectedBalance = (BigInt(initialBalance) + BigInt(stakeAmount)).toString()
        assert.equal(finalBalance, expectedBalance, "\x1b[31mTokens not returned correctly\x1b[0m")

        // Set cooldown period to previous value
        await ao.msg({ pid: stakingPid, act: "Eval", data: `CooldownPeriod = "${CooldownPeriod}"` })

        // Check if the cooldown period is set to previous value
        const CooldownState = await ao.msg({ pid: stakingPid, act: "Eval", data: `CooldownPeriod`, get: true })
        assert.equal(CooldownState.res.Output.data, CooldownPeriod, "Cooldown period should be set to previous value")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`)

      }
    })

    it("should fail to withdraw with no stake record", async () => {
      try {

        // Generate a new wallet with no stake
        const ar = ao.ar
        const { jwk } = await ar.gen("1")

        // Attempt to withdraw
        const { res } = await stakingProcess.msg("Withdraw", {}, { jwk: jwk })

        // Check that the withdrawal was rejected
        assert(res.Error.includes("No stake record found"), "\x1b[31mWithdraw should fail when no stake record exists\x1b[0m")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`)

      }
    })
  })

  describe("Slash Proposal Tests", function () {
    let proposalId;

    // Before running these tests, ensure participants have stakes
    before(async () => {
      try {
        console.log("\x1b[33m== Setting up for slash proposal tests ==\x1b[0m");

        // Bob needs to stake again since he withdrew in the previous tests
        const bobStakeAmount = MinimumStake;

        // Only stake if Bob has no active stake
        console.log("\x1b[36mRestaking tokens for Bob...\x1b[0m");
        await tokenProcess.msg("Transfer", {
          Recipient: stakingPid,
          Quantity: bobStakeAmount,
          "X-Action": "Stake"
        }, { jwk: bob.jwk });

        // Verify Bob's stake was created
        const updatedStake = await stakingProcess.msg("View-Stake", { Target: bob.addr });
        assert.equal(updatedStake.out.stake.amount, bobStakeAmount, "\x1b[31mBob's stake not created correctly\x1b[0m");

      } catch (error) {
        console.error(`\x1b[31mSlash test setup failed: ${error.message}\x1b[0m`);
        throw error;
      }
    });

    it("should create a slash proposal targeting a staker", async () => {
      try {

        // First ensure charlie has an active stake
        const charlieStakeResult = await stakingProcess.msg("View-Stake", { Target: charlie.addr });
        assert.equal(charlieStakeResult.out.stake.status, "STAKED", "\x1b[31mCharlie should have an active stake\x1b[0m");

        // Alice creates a slash proposal against Charlie
        const reason = "Validator downtime";
        const { out: createResult } = await stakingProcess.msg("Create-Slash-Proposal", {
          Target: charlie.addr,
          Reason: reason
        }, {
          get: { Data: { data: true, json: true }, Action: "Action" },
          jwk: alice.jwk
        });

        // Store proposal ID for later tests
        proposalId = createResult.Data.proposalId;

        // Verify proposal was created
        assert.equal(createResult.Action, "Slash-Proposal-Created", "\x1b[31mSlash proposal creation failed\x1b[0m");
        assert.equal(createResult.Data.targetAddress, charlie.addr, "\x1b[31mWrong target in slash proposal\x1b[0m");
        assert.equal(createResult.Data.reason, reason, "\x1b[31mWrong reason in slash proposal\x1b[0m");

        // Check proposal exists in the system
        const { out: proposalDetails } = await stakingProcess.msg("View-Proposal-By-Id", {
          ProposalId: proposalId
        }, {
          get: { Data: { data: true, json: true } }
        });

        assert.equal(proposalDetails.Data.status, "OPEN", "\x1b[31mProposal should be in OPEN status\x1b[0m");
        assert.equal(proposalDetails.Data.proposer, alice.addr, "\x1b[31mWrong proposer for slash proposal\x1b[0m");

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);
        throw error;
      }
    });

    it("should fail to create a slash proposal for non-staker", async () => {
      try {
        console.log("\x1b[36mTesting slash proposal for non-staker...\x1b[0m");

        // Generate a random address that has no stake
        const ar = ao.ar;
        const { addr } = await ar.gen("1");

        // Try to create a slash proposal against a non-staker
        const { res } = await stakingProcess.msg("Create-Slash-Proposal", {
          Target: addr,
          Reason: "Invalid target"
        }, { jwk: alice.jwk });

        // Verify the error
        assert(res.Error.includes("Target must have an active stake"), "\x1b[31mSlash proposal should fail for non-stakers\x1b[0m");

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);
        throw error;
      }
    });

    it("should allow voting on slash proposals", async () => {
      try {

        // Verify Bob has an active stake before voting
        const bobStakeCheck = await stakingProcess.msg("View-Stake", { Target: bob.addr });
        assert(bobStakeCheck.out.stake.amount !== "0", "\x1b[31mBob needs an active stake to vote\x1b[0m");

        // Bob votes Yes on the proposal
        const { out: voteResult } = await stakingProcess.msg("Vote-Slash-Proposal", {
          ProposalId: proposalId,
          Vote: "Yes"
        }, {
          get: { Data: { data: true, json: true }, Action: "Action" },
          jwk: bob.jwk
        });

        // Verify vote was recorded
        assert.equal(voteResult.Action, "Slash-Vote-Recorded", "\x1b[31mVote was not recorded\x1b[0m");
        assert.equal(voteResult.Data.proposalId, proposalId, "\x1b[31mWrong proposal ID in vote response\x1b[0m");
        assert.equal(voteResult.Data.vote, "Yes", "\x1b[31mWrong vote value in response\x1b[0m");

        // Alice votes No on the proposal
        await stakingProcess.msg("Vote-Slash-Proposal", {
          ProposalId: proposalId,
          Vote: "No"
        }, { jwk: alice.jwk });

        // Check vote counts in proposal
        const { out: proposalDetails } = await stakingProcess.msg("View-Proposal-By-Id", {
          ProposalId: proposalId
        }, {
          get: { Data: { data: true, json: true } }
        });

        // Ensure both votes are recorded
        assert.equal(proposalDetails.Data.votes.total, 2, "\x1b[31mIncorrect vote count\x1b[0m");

        // Check vote details to verify voter weights
        let foundBob = false;
        let foundAlice = false;

        for (const vote of proposalDetails.Data.votes.details) {
          if (vote.voter === bob.addr) {
            foundBob = true;
            assert.equal(vote.vote, "Yes", "\x1b[31mBob's vote incorrect\x1b[0m");
          }
          if (vote.voter === alice.addr) {
            foundAlice = true;
            assert.equal(vote.vote, "No", "\x1b[31mAlice's vote incorrect\x1b[0m");
          }
        }

        assert(foundBob, "\x1b[31mBob's vote not found\x1b[0m");
        assert(foundAlice, "\x1b[31mAlice's vote not found\x1b[0m");

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);
      }
    });

    it("should prevent voting twice on the same proposal", async () => {
      try {

        // Bob tries to vote again
        const { res } = await stakingProcess.msg("Vote-Slash-Proposal", {
          ProposalId: proposalId,
          Vote: "No"
        }, { jwk: bob.jwk });

        // Verify the error
        assert(res.Error.includes("Already voted"), "\x1b[31mDouble voting should be prevented\x1b[0m");

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);
      }
    });

    it("should fail voting with invalid vote value", async () => {
      try {

        // Charlie tries to vote with invalid value
        const { res } = await stakingProcess.msg("Vote-Slash-Proposal", {
          ProposalId: proposalId,
          Vote: "Maybe"  // Invalid value
        }, { jwk: charlie.jwk });

        // Verify the error
        assert(res.Error.includes("Vote must be exactly 'Yes' or 'No'"), "\x1b[31mInvalid vote value should be rejected\x1b[0m");

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);
        throw error;
      }
    });

    it("should fail to finalize proposal before voting period ends", async () => {
      try {

        // Try to finalize the proposal too early
        const { res } = await stakingProcess.msg("Finalize-Slash-Proposal", {
          ProposalId: proposalId
        }, { jwk: alice.jwk });

        // Verify the error
        assert(res.Error.includes("Voting period not yet complete"), "\x1b[31mEarly finalization should be prevented\x1b[0m");

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);

      }
    });

    it("should allow viewing all proposals", async () => {
      try {

        // Get all proposals
        const { out: allProposals } = await stakingProcess.msg("View-All-Proposals", {}, {
          get: { Data: { data: true, json: true } }
        });

        // Verify our proposal is in the list
        assert(allProposals.Data.totalProposals > 0, "\x1b[31mShould have at least one proposal\x1b[0m");

        let foundProposal = false;
        for (const proposal of allProposals.Data.proposals) {
          if (proposal.proposalId === proposalId) {
            foundProposal = true;
            assert.equal(proposal.targetAddress, charlie.addr, "\x1b[31mWrong target in proposal list\x1b[0m");
            break;
          }
        }

        assert(foundProposal, "\x1b[31mProposal not found in the list\x1b[0m");

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);
        throw error;
      }
    });

    it("should successfully finalize slash proposal after voting period", async () => {
      try {

        // Record Charlie's initial stake amount
        const initialStakeResult = await stakingProcess.msg("View-Stake", { Target: charlie.addr });
        const initialStakeAmount = initialStakeResult.out.stake.amount;

        // Have Charlie vote Yes to make sure the proposal passes
        await stakingProcess.msg("Vote-Slash-Proposal", {
          ProposalId: proposalId,
          Vote: "Yes"
        }, { jwk: charlie.jwk });

        // Advance time to end voting period
        await ao.msg({ pid: stakingPid, act: "Eval", data: `SlashConfig.VOTING_PERIOD = 1` });

        // Finalize the proposal
        const res = await stakingProcess.msg("Finalize-Slash-Proposal", {
          ProposalId: proposalId
        }, {
          get: { Data: { data: true, json: true }, Action: "Action" },
          check: { Action: "Slash-Proposal-Finalized" },
          jwk: alice.jwk,
          timeout: 5000
        });
        // const finalizeResult = res.results[0].res.Messages[1]
        const finalizeResultData = JSON.parse(res.results[0].res.Messages[1].Data)
        // Verify finalization
        // assert.equal(finalizeResult.Action, "Slash-Proposal-Finalized", "\x1b[31mProposal finalization failed\x1b[0m");
        assert.equal(finalizeResultData.proposalId, proposalId, "\x1b[31mWrong proposal ID in finalization\x1b[0m");
        assert.equal(finalizeResultData.passed, true, "\x1b[31mProposal should have passed\x1b[0m");
        assert.equal(finalizeResultData.status, "EXECUTED", "\x1b[31mProposal status should be EXECUTED\x1b[0m");
        // Verify Charlie's stake was slashed
        const finalStakeResult = await stakingProcess.msg("View-Stake", { Target: charlie.addr });
        const finalStakeAmount = finalStakeResult.out.stake.amount;
        assert(BigInt(finalStakeAmount) < BigInt(initialStakeAmount), "\x1b[31mStake should be reduced after slashing\x1b[0m");

        // The slash amount should be 20% of the initial stake
        const expectedSlashed = (BigInt(initialStakeAmount) * BigInt(20) / BigInt(100)).toString();
        const expectedRemaining = (BigInt(initialStakeAmount) - BigInt(expectedSlashed)).toString();
        assert.equal(finalStakeAmount, expectedRemaining, "\x1b[31mIncorrect slash amount\x1b[0m");

        // Set slash config to previous value
        await ao.msg({ pid: stakingPid, act: "Eval", data: `SlashConfig.VOTING_PERIOD = "${SlashVotingPeriod}"` })

        // Check if the cooldown period is set to previous value
        const SlashConfigState = await ao.msg({ pid: stakingPid, act: "Eval", data: `SlashConfig.VOTING_PERIOD`, get: true })
        assert.equal(SlashConfigState.res.Output.data, SlashVotingPeriod, "Slash config should be set to previous value")

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);
      }
    });

    it("should fail to finalize already finalized proposal", async () => {
      try {

        // Try to finalize again
        const { res } = await stakingProcess.msg("Finalize-Slash-Proposal", {
          ProposalId: proposalId
        }, { jwk: alice.jwk });

        // Verify the error
        assert(res.Error.includes("Proposal already finalized"), "\x1b[31mDouble finalization should be prevented\x1b[0m");

      } catch (error) {
        console.error(`\x1b[31mTest failed: ${error.message}\x1b[0m`);
      }
    });
  })

})