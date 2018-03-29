# binance-profit-calculator
This tool reads your TradeHistory.xlsx file exported from Binance and collects profit information based on pairs. If you have bags, it also tries to figure out what your un-matched trade profit is. *(un-matched trade is a BUY order that has no corresponding SELL order yet)*

![binance-profit-calculator](https://cdn.discordapp.com/attachments/411967752459386880/428851267100475392/Screen_Shot_2018-03-29_at_3.39.26_AM.png)

## Instructions

You need Node.js to run this app. Download and install version 9.x from here: https://nodejs.org/

1. Download this repository
2. Run `npm install`
3. Export your **Trade History** from Binance *(mixing and matching base currencies isn't supported yet)*
4. Save/Move that file to this directory *(make sure the file is named `TradeHistory.xlsx`)*
5. Run `npm start`
