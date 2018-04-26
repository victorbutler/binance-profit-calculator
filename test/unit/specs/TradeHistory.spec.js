import TradeHistoryLib from '#/tradeHistory'
import Big from 'big.js'

describe('TradeHistoryLib', () => {
  const calculate = (lines, database = false) => {
    let databaseContainer = database || {}
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
      databaseContainer = TradeHistoryLib.LineProcessor(line, databaseContainer, (database !== false ? true : false))
    }
    databaseContainer = TradeHistoryLib.BagProcessor(databaseContainer)
    databaseContainer = TradeHistoryLib.ProfitProcessor(databaseContainer)
    return databaseContainer
  }
  it('should calculate correct total profits', () => {
    const lines = [
      {
        'Date(UTC)': '2018-04-26 02:26:44',
        'Market': 'NEBLETH',
        'Type': 'SELL',
        'Price': '0.018551',
        'Amount': '55',
        'Total': '1.020305',
        'Fee': '0.02354768',
        'Fee Coin': 'BNB'
      },
      {
        'Date(UTC)': '2018-04-26 00:29:32',
        'Market': 'NEBLETH',
        'Type': 'BUY',
        'Price': '0.018242',
        'Amount': '46.48',
        'Total': '0.84788816',
        'Fee': '0.01924062',
        'Fee Coin': 'BNB'
      },
      {
        'Date(UTC)': '2018-04-26 00:29:32',
        'Market': 'NEBLETH',
        'Type': 'BUY',
        'Price': '0.01824',
        'Amount': '8.52',
        'Total': '0.1554048',
        'Fee': '0.00352689',
        'Fee Coin': 'BNB'
      }
    ]
    const profit = Big('0.01701204')
    const databaseContainer = calculate(lines)
    expect(databaseContainer.ETH.profitPlusBags)
      .toEqual(profit)
  })
  it('should calculate correct profits without Bags', () => {
    const lines = [
      {
        'Date(UTC)': '2018-04-26 00:29:32',
        'Market': 'NEBLETH',
        'Type': 'BUY',
        'Price': '0.018242',
        'Amount': '46.48',
        'Total': '0.84788816',
        'Fee': '0.01924062',
        'Fee Coin': 'BNB'
      },
      {
        'Date(UTC)': '2018-04-26 00:29:32',
        'Market': 'NEBLETH',
        'Type': 'BUY',
        'Price': '0.01824',
        'Amount': '8.52',
        'Total': '0.1554048',
        'Fee': '0.00352689',
        'Fee Coin': 'BNB'
      }
    ]
    const profit = Big('0')
    const databaseContainer = calculate(lines)
    expect(databaseContainer.ETH.profitMinusBags)
      .toEqual(profit)
  })
  it('should calculate correct profits with Bags', () => {
    const lines = [
      {
        'Date(UTC)': '2018-04-26 00:29:32',
        'Market': 'NEBLETH',
        'Type': 'BUY',
        'Price': '0.018242',
        'Amount': '46.48',
        'Total': '0.84788816',
        'Fee': '0.01924062',
        'Fee Coin': 'BNB'
      },
      {
        'Date(UTC)': '2018-04-26 00:29:32',
        'Market': 'NEBLETH',
        'Type': 'BUY',
        'Price': '0.01824',
        'Amount': '8.52',
        'Total': '0.1554048',
        'Fee': '0.00352689',
        'Fee Coin': 'BNB'
      }
    ]
    const profit = Big('-1.00329296')
    const databaseContainer = calculate(lines)
    expect(databaseContainer.ETH.profitPlusBags)
      .toEqual(profit)
  })
  describe('Streaming', () => {
    it('should calculate correct profits via streaming, no bags', () => {
      let existingDatabaseContainer = TradeHistoryLib.DatabaseContainerNormalizer({
        "ETH": {
          "pairs": [{
            "Market": "NEBLETH",
            "Coin": "NEBL",
            "Amount": "55",
            "Fee": "0.02276751",
            "Bought": "1.00329296",
            "Sold": "0",
            "Difference": "-1.00329296",
            "DifferenceWithoutBags": "0",
            "_data": [{
              "Date(UTC)": "2018-04-26 00:29:32",
              "Market": "NEBLETH",
              "Type": "BUY",
              "Price": "0.018242",
              "Amount": "46.48",
              "Total": "0.84788816",
              "Fee": "0.01924062",
              "Fee Coin": "BNB"
            }, {
              "Date(UTC)": "2018-04-26 00:29:32",
              "Market": "NEBLETH",
              "Type": "BUY",
              "Price": "0.01824",
              "Amount": "8.52",
              "Total": "0.1554048",
              "Fee": "0.00352689",
              "Fee Coin": "BNB"
            }]
          }],
          "_pairs": ["NEBLETH"],
          "bags": [{
            "Market": "NEBLETH",
            "Amount": "55",
            "BoughtValue": "1.00329296",
            "_data": [{
              "Date(UTC)": "2018-04-26 00:29:32",
              "Market": "NEBLETH",
              "Type": "BUY",
              "Price": "0.018242",
              "Amount": "46.48",
              "Total": "0.84788816",
              "Fee": "0.01924062",
              "Fee Coin": "BNB"
            }, {
              "Date(UTC)": "2018-04-26 00:29:32",
              "Market": "NEBLETH",
              "Type": "BUY",
              "Price": "0.01824",
              "Amount": "8.52",
              "Total": "0.1554048",
              "Fee": "0.00352689",
              "Fee Coin": "BNB"
            }]
          }],
          "_bags": ["NEBLETH"],
          "total": {
            "bought": "1.00329296",
            "sold": "0",
            "difference": "0",
            "fees": "0.02276751"
          },
          "profitMinusBags": "0",
          "profitPlusBags": "-1.00329296"
        }
      })
      const stream = {
        'Date(UTC)': '2018-04-26 02:26:44',
        'Market': 'NEBLETH',
        'Type': 'SELL',
        'Price': '0.018551',
        'Amount': '55',
        'Total': '1.020305',
        'Fee': '0.02354768',
        'Fee Coin': 'BNB'
      }
      const profit = Big('0.01701204')
      const databaseContainer = calculate([stream], existingDatabaseContainer)
      expect(databaseContainer.ETH.profitPlusBags)
        .toEqual(profit)
    })
    it('should calculate correct profits via streaming, all bags', () => {
      let existingDatabaseContainer = TradeHistoryLib.DatabaseContainerNormalizer({
        "ETH": {
          "pairs": [{
            "Market": "NEBLETH",
            "Coin": "NEBL",
            "Amount": "46.48",
            "Fee": "0.01924062",
            "Bought": "0.84788816",
            "Sold": "0",
            "Difference": "-0.84788816",
            "DifferenceWithoutBags": "0",
            "_data": [{
              "Date(UTC)": "2018-04-26 00:29:32",
              "Market": "NEBLETH",
              "Type": "BUY",
              "Price": "0.018242",
              "Amount": "46.48",
              "Total": "0.84788816",
              "Fee": "0.01924062",
              "Fee Coin": "BNB"
            }]
          }],
          "_pairs": ["NEBLETH"],
          "bags": [{
            "Market": "NEBLETH",
            "Amount": "46.48",
            "BoughtValue": "0.84788816",
            "_data": [{
              "Date(UTC)": "2018-04-26 00:29:32",
              "Market": "NEBLETH",
              "Type": "BUY",
              "Price": "0.018242",
              "Amount": "46.48",
              "Total": "0.84788816",
              "Fee": "0.01924062",
              "Fee Coin": "BNB"
            }]
          }],
          "_bags": ["NEBLETH"],
          "total": {
            "bought": "0.84788816",
            "sold": "0",
            "difference": "0",
            "fees": "0.01924062"
          },
          "profitMinusBags": "0",
          "profitPlusBags": "-0.84788816"
        }
      })
      const stream = {
        'Date(UTC)': '2018-04-26 00:29:32',
        'Market': 'NEBLETH',
        'Type': 'BUY',
        'Price': '0.01824',
        'Amount': '8.52',
        'Total': '0.1554048',
        'Fee': '0.00352689',
        'Fee Coin': 'BNB'
      }
      const profit = Big('-1.00329296')
      const databaseContainer = calculate([stream], existingDatabaseContainer)
      expect(databaseContainer.ETH.profitPlusBags)
        .toEqual(profit)
    })
  })
})
