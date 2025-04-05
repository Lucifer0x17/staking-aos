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
        throw error;
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
        throw error
      }
    })
  })

})