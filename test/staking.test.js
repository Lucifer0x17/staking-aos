import fs from 'fs'
import { aoslocal } from '@permaweb/loco'
const tokenProcess = await aoslocal()
// load source into local process
const data = await tokenProcess.src('../src/token.lua', {
    Process: {
        Id: "TEST_PROCESS_ID",
    }
})

const stakeProcess = await aoslocal()
// load source into local process
await stakeProcess.src('../src/staking.lua')

console.log(tokenProcess, data)
