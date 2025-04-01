import assert from "assert"
import { describe, it } from "node:test"
import { AO, acc, connect } from "wao/test"

const { dryrun } = connect()
const src_data = `
STATE="Ayush"
Handlers.add("Hello", "Hello", function (msg)
  msg.reply({ Data = "Hello, World!" })
end)
`
describe("WAO", function () {
    it("should spawn a process and send messages", async () => {
        const ao = await new AO().init(acc[0])
        const { p } = await ao.deploy({ src_data })
        console.log(p)
        const out = await p.d("Hello")
        console.log(out)
        // const out2 = await dryrun({
        //     process: p.pid,
        //     tags: [{ name: "Action", value: "Eval" }],
        //     data: "STATE",
        //     signer: acc[0]
        // })
        const out2 = await p.d("Eval", { Data: `1+1` })
        console.log("OUT2:>>>>>", out2)
        assert.deepEqual(out, "Hello, World!")
    })
})