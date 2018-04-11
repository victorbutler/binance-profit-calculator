# binance-profit-calculator
This tool reads your TradeHistory.xlsx file exported from Binance and collects profit information based on pairs. If you have bags, it also tries to figure out what your un-matched trade profit is. *(un-matched trade is a BUY order that has no corresponding SELL order yet)*

![binance-profit-calculator](https://cdn.discordapp.com/attachments/411967752459386880/433765650591383564/Screen_Shot_2018-04-11_at_5.07.38_PM.png)

## Instructions

You need Node.js to run this app. Download and install version 9.x from here: https://nodejs.org/

1. Download this repository
2. Run `npm install`
3. Export your **Trade History** from Binance
4. Run `npm start`
5. Go to http://localhost:7000 in your browser
