const xlsx = require('xlsx')
const Big = require('big.js')

const markets = ['BTC', 'ETH', 'XMR', 'USDT', 'BNB']

const detectMarket = coinpair => {
  const marketRegex = new RegExp('(' + markets.join('|') + ')$', 'i')
  const result = coinpair.match(marketRegex)
  return (result ? result[1] : false)
}

module.exports = (filename) => {

  const wb = xlsx.readFile(filename)
  const lines = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
  let databaseContainer = {}

  const databaseTemplate = {
    pairs: [],
    _pairs: [],
    bags: [],
    _bags: [],
    total: {
      bought: Big(0),
      sold: Big(0),
      difference: Big(0),
      fees: Big(0)
    },
    profitMinusBags: Big(0),
    profitPlusBags: Big(0)
  }

  for (let line of lines) {
    const market = detectMarket(line.Market)
    const coin = line.Market.replace(new RegExp(market + '$'), '')
    if (typeof databaseContainer[market] == 'undefined') {
      // This is the database template below
      databaseContainer[market] = {
        pairs: [],
        _pairs: [],
        bags: [],
        _bags: [],
        total: {
          bought: Big(0),
          sold: Big(0),
          difference: Big(0),
          fees: Big(0)
        },
        profitMinusBags: Big(0),
        profitPlusBags: Big(0)
      }
    }
    let database = databaseContainer[market]
    line.Price = Big(line.Price)
    line.Amount = Big(line.Amount)
    line.Total = Big(line.Total)
    line.Fee = Big(line.Fee)
    if (database._pairs.indexOf(line.Market) === -1) {
      database._pairs.push(line.Market)
      if (line.Type === 'SELL') {
        // line.Total *= -1
        line.Amount = line.Amount.times(-1)
      }
      database.pairs.push({
        Market: line.Market,
        Coin: coin,
        Amount: line.Amount,
        Fee: line.Fee,
        Bought: (line.Type === 'BUY') ? line.Total : Big(0),
        Sold: (line.Type === 'SELL') ? line.Total : Big(0),
        Difference: (line.Type === 'BUY') ? line.Total.times(-1) : Big(0),
        DifferenceWithoutBags: Big(0),
        _data: [line]
      })
    } else {
      if (line.Type === 'BUY') {
        database.pairs[database._pairs.indexOf(line.Market)].Bought = database.pairs[database._pairs.indexOf(line.Market)].Bought.plus(line.Total)
      } else if (line.Type === 'SELL') {
        // line.Total = line.Total * -1
        line.Amount = line.Amount.times(-1)
        database.pairs[database._pairs.indexOf(line.Market)].Sold = database.pairs[database._pairs.indexOf(line.Market)].Sold.plus(line.Total)
      }
      // database.pairs[database._pairs.indexOf(line.Market)].Total += line.Total
      database.pairs[database._pairs.indexOf(line.Market)].Fee = database.pairs[database._pairs.indexOf(line.Market)].Fee.plus(line.Fee)
      database.pairs[database._pairs.indexOf(line.Market)].Amount = database.pairs[database._pairs.indexOf(line.Market)].Amount.plus(line.Amount)
      database.pairs[database._pairs.indexOf(line.Market)].Difference = database.pairs[database._pairs.indexOf(line.Market)].Sold.minus(database.pairs[database._pairs.indexOf(line.Market)].Bought)
      database.pairs[database._pairs.indexOf(line.Market)].DifferenceWithoutBags = database.pairs[database._pairs.indexOf(line.Market)].Sold.minus(database.pairs[database._pairs.indexOf(line.Market)].Bought)
      database.pairs[database._pairs.indexOf(line.Market)]._data.push(line)
    }
    if (line.Type === 'BUY') {
      database.total.bought = database.total.bought.plus(line.Total)
    } else if (line.Type === 'SELL') {
      database.total.sold = database.total.sold.plus(line.Total)
    }
    database.total.fees = database.total.fees.plus(line.Fee)
  }

  /**
   * At this point, our totals are correct (including Bags)
   * Now we try to backtrack and remove Bag totals to see
   * profit of complete matched trades. It gets complicated
   * here because now we have to look in the pair history and
   * match up the leftover coin amount to the last BUYs. If
   * they match, then we know the value to deduct from the total
   * to get an accurate difference. This can sometimes be unreliable
   * if you buy and sell the same coin pair without fully selling off
   * that coin pair amount held first.
   **/

  // Search the pairs for any pairs with Amount > 0 (unsold coins)
  for (let market in databaseContainer) {
    let database = databaseContainer[market]
    for (var coinpair of database.pairs) {
      if (coinpair.Amount.gt(0)) {
        let amountToRectify = coinpair.Amount
        let matchedCompletely = false
        let _dataIndexer = 0
        while (amountToRectify.gt(0) && _dataIndexer < coinpair._data.length && matchedCompletely === false) {
          // We are going to assume the data from Binance hasn't been altered and the dates are in descending order
          if (coinpair._data[_dataIndexer].Type === 'BUY') { // BUY is good, we're on the right track
            amountToRectify = amountToRectify.minus(coinpair._data[_dataIndexer].Amount)
          }
          if (database._bags.indexOf(coinpair.Market) === -1) {
            database._bags.push(coinpair.Market)
            database.bags.push({
              Market: coinpair.Market,
              Amount: coinpair._data[_dataIndexer].Amount,
              BoughtValue: coinpair._data[_dataIndexer].Total,
              _data: [coinpair._data[_dataIndexer]]
            })
          } else {
            database.bags[database._bags.indexOf(coinpair.Market)].Amount = database.bags[database._bags.indexOf(coinpair.Market)].Amount.plus(coinpair._data[_dataIndexer].Amount)
            database.bags[database._bags.indexOf(coinpair.Market)].BoughtValue = database.bags[database._bags.indexOf(coinpair.Market)].BoughtValue.plus(coinpair._data[_dataIndexer].Total)
            database.bags[database._bags.indexOf(coinpair.Market)]._data.push(coinpair._data[_dataIndexer])
          }
          if (amountToRectify.eq(0)) {
            matchedCompletely = true
            coinpair.DifferenceWithoutBags = database.bags[database._bags.indexOf(coinpair.Market)].BoughtValue.plus(coinpair.Difference).toString()
          }
          _dataIndexer++
        }
      }
    }
  }

  // console.log('MARKET, AMOUNT, FEE, BOUGHT, SOLD, PROFIT +BAGS, PROFIT -BAGS')
  for (let market in databaseContainer) {
    let profitMinusBags = Big(0)
    let profitPlusBags = Big(0)
    for (var profit of databaseContainer[market].pairs) {
      profitMinusBags = profitMinusBags.plus(profit.DifferenceWithoutBags)
      profitPlusBags = profitPlusBags.plus(profit.Difference)
      // console.log(profit.Market + ', ' + profit.Amount.toString() + ', ' + profit.Fee.toString() + ', ' + profit.Bought.toString() + ', ' + profit.Sold.toString() + ', ' + profit.Difference.toString() + ', ' + profit.DifferenceWithoutBags.toString())
    }
    databaseContainer[market].profitMinusBags = profitMinusBags
    databaseContainer[market].profitPlusBags = profitPlusBags
  }
  // console.log('Profit -Bags:', profitMinusBags.toString(), 'Profit +Bags:', profitPlusBags.toString())
  // TODO: Get the market price for each Bag pair to show what profit would be if you sold right now
  return databaseContainer
}
