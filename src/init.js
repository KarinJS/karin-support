import { Core } from 'karin-screenshot'
const chrome = new Core({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
    devtools: false,
    dir: process.cwd(),
    browserCount: 10
})
await chrome.init()
process.exit(0)