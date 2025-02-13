import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const Dashboard = () => {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [portfolio, setPortfolio] = useState([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  const [chartData, setChartData] = useState(null);
  const [selectedCoin, setSelectedCoin] = useState(null); 
  const [chartLoading, setChartLoading] = useState(false);

  const [editValues, setEditValues] = useState({});

  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(null);

  const token = localStorage.getItem('token');

    /* get users coin/port each user has a token must be used and session saved to token with db */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [coinsResponse, portfolioResponse] = await Promise.all([
          axios.get('http://localhost:5001/api/coins'),
          axios.get('http://localhost:5001/api/portfolio', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
        ]);
        setCoins(coinsResponse.data);
        setPortfolio(portfolioResponse.data);
        setLoading(false);
        setPortfolioLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
        setPortfolioLoading(false);
      }
    };
    fetchData();
  }, [token]);

     /* get news for user */
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await axios.get('http://localhost:5001/api/news');
        setNews(response.data);
        setNewsLoading(false);
      } catch (error) {
        console.error('Error fetching news:', error);
        setNewsError('Failed to fetch news');
        setNewsLoading(false);
      }
    };
    fetchNews();
  }, []);
   /* search coins for user  */
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const response = await axios.get('http://localhost:5001/api/search', {
        params: { query: searchQuery }
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Error searching for coins:', error);
    }
  };

     /* add coin to user port that saves  */
  const handleAddToPortfolio = async (coin) => {
    const unitsStr = window.prompt(`How many units of ${coin.name} do you want to add?`, "1");
    if (unitsStr === null) return;
    const units = parseFloat(unitsStr);
    if (isNaN(units) || units <= 0) {
      alert('Please enter a valid positive number for units.');
      return;
    }

    const buyPriceStr = window.prompt(`Enter the price you paid per unit of ${coin.name} (your cost basis):`, "");
    if (buyPriceStr === null) return;
    const bought_price = parseFloat(buyPriceStr);
    if (isNaN(bought_price) || bought_price <= 0) {
      alert('Please enter a valid positive number for the bought price.');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5001/api/portfolio', {
        coin_id: coin.id,
        units,
        bought_price,
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // add the new portfolio item to state
      setPortfolio([...portfolio, response.data]);
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding to portfolio:', error);
      alert(error.response?.data?.error || 'Failed to add to portfolio');
    }
  };
 /*history price of chart for coin  */
  const fetchChartData = async (coinId, days = 7) => {
    if (!coinId) return;
    setChartLoading(true);
    try {
      const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`, {
        params: {
          vs_currency: 'usd',
          days: days
        }
      });

      const prices = response.data.prices; 
      const labels = prices.map(p => new Date(p[0]).toLocaleDateString());
      const dataPoints = prices.map(p => p[1]);

      const data = {
        labels: labels,
        datasets: [
          {
            label: `${coinId.charAt(0).toUpperCase() + coinId.slice(1)} Price (USD)`,
            data: dataPoints,
            borderColor: '#00b894',
            backgroundColor: 'rgba(0, 184, 148, 0.1)',
            tension: 0.1,
          },
        ],
      };

      setChartData(data);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCoin) {
      fetchChartData(selectedCoin);
    }
  }, [selectedCoin]);


     /*math logic to handle pnl if user made profit or loss  */
  const totalPortfolioValue = portfolio.reduce((acc, coin) => {
    if (coin.current_price && coin.units) {
      return acc + (coin.current_price * coin.units);
    }
    return acc;
  }, 0);

  const totalPNL = portfolio.reduce((acc, coin) => {
    if (coin.current_price && coin.bought_price && coin.units) {
      const pnl = coin.units * (coin.current_price - coin.bought_price);
      return acc + pnl;
    }
    return acc;
  }, 0);

  const handleEditChange = (coinId, field, value) => {
    setEditValues((prev) => ({
      ...prev,
      [coinId]: {
        ...prev[coinId],
        [field]: value
      }
    }));
  };

  const handleSave = async (coin) => {
    const newValues = editValues[coin.id] || {};
    const updatedUnits = parseFloat(newValues.units ?? coin.units);
    const updatedBoughtPrice = parseFloat(newValues.bought_price ?? coin.bought_price);

    if (isNaN(updatedUnits) || updatedUnits <= 0) {
      alert('Please enter a valid positive number for units.');
      return;
    }

    if (isNaN(updatedBoughtPrice) || updatedBoughtPrice <= 0) {
      alert('Please enter a valid positive number for bought price.');
      return;
    }

    try {
      const response = await axios.put(`http://localhost:5001/api/portfolio/${coin.id}`, {
        units: updatedUnits,
        bought_price: updatedBoughtPrice,
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // update the portfolio in state
      setPortfolio(portfolio.map(c => c.id === coin.id ? response.data : c));
      setEditValues(prev => {
        const { [coin.id]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      console.error('Error saving portfolio changes:', error);
      alert(error.response?.data?.error || 'Failed to save changes');
    }
  };

  const handleDelete = async (coinId) => {
    if (!window.confirm('Are you sure you want to remove this coin from your portfolio?')) return;

    try {
      await axios.delete(`http://localhost:5001/api/portfolio/${coinId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // remove the portfolio item from state
      setPortfolio(portfolio.filter(c => c.id !== coinId));
    } catch (error) {
      console.error('Error deleting portfolio entry:', error);
      alert(error.response?.data?.error || 'Failed to delete portfolio entry');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Crypto Tracker V1</h1>
      </header>

      {/* search section */}
      <div className="search-container">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search for a coin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </div>

      {/* search Results */}
      {searchResults.length > 0 && (
        <div className="search-results-container">
          <h2 className="section-heading">Search Results</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Symbol</th>
                <th>Market Cap Rank</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((coin) => (
                <tr key={coin.id}>
                  <td>
                    <img src={coin.thumb} alt={coin.name} width="20" />
                    {coin.name}
                  </td>
                  <td>{coin.symbol.toUpperCase()}</td>
                  <td>{coin.market_cap_rank || 'N/A'}</td>
                  <td><button onClick={() => handleAddToPortfolio(coin)}>Add to Portfolio</button></td>
                  <td><button onClick={() => setSelectedCoin(coin.id)}>View Chart</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* main Coins Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          <h2 className="section-heading">Top Coins</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Change (24h)</th>
                <th>Market Cap</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coins.map((coin) => (
                <tr key={coin.id}>
                  <td>
                    <img src={coin.image} alt={coin.name} width="20" />
                    {coin.name}
                  </td>
                  <td>${coin.current_price.toLocaleString()}</td>
                  <td style={{ color: coin.price_change_percentage_24h > 0 ? 'green' : 'red' }}>
                    {coin.price_change_percentage_24h.toFixed(2)}%
                  </td>
                  <td>${coin.market_cap.toLocaleString()}</td>
                  <td><button onClick={() => handleAddToPortfolio(coin)}>Add to Portfolio</button></td>
                  <td><button onClick={() => setSelectedCoin(coin.id)}>View Chart</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* portfolio Section */}
      {portfolioLoading ? (
        <p>Loading portfolio...</p>
      ) : portfolio.length > 0 && (
        <div className="portfolio-container">
          <h2 className="section-heading">My Portfolio</h2>
          <p style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '10px' }}>
            Total Portfolio Value: ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '20px', color: totalPNL >= 0 ? 'green' : 'red' }}>
            Total PnL: ${totalPNL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Symbol</th>
                <th>Units</th>
                <th>Bought Price</th>
                <th>Current Price (USD)</th>
                <th>Value</th>
                <th>PNL</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((coin) => {
                const editData = editValues[coin.id] || {};
                const displayUnits = editData.units !== undefined ? editData.units : coin.units;
                const displayBoughtPrice = editData.bought_price !== undefined ? editData.bought_price : coin.bought_price;

                const parsedUnits = parseFloat(displayUnits);
                const parsedBoughtPrice = parseFloat(displayBoughtPrice);
                const currentPrice = coin.current_price || 0;

                const coinValue = (parsedUnits > 0 && currentPrice > 0)
                  ? parsedUnits * currentPrice
                  : 0;

                const pnl = (parsedUnits > 0 && parsedBoughtPrice > 0 && currentPrice > 0)
                  ? parsedUnits * (currentPrice - parsedBoughtPrice)
                  : 0;

                return (
                  <tr key={coin.id}>
                    <td>
                      {coin.thumb ? (
                        <img src={coin.thumb} alt={coin.name} width="20" />
                      ) : (
                        coin.image && <img src={coin.image} alt={coin.name} width="20" />
                      )}
                      {coin.coin_id}
                    </td>
                    <td>{coin.symbol?.toUpperCase()}</td>
                    <td>
                      <input
                        type="number"
                        step="0.0001"
                        value={displayUnits}
                        onChange={(e) => handleEditChange(coin.id, 'units', e.target.value)}
                        style={{ width: '70px', textAlign: 'right', padding: '4px', background: '#1e1e1e', color: '#fff', border: '1px solid #333' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={displayBoughtPrice}
                        onChange={(e) => handleEditChange(coin.id, 'bought_price', e.target.value)}
                        style={{ width: '100px', textAlign: 'right', padding: '4px', background: '#1e1e1e', color: '#fff', border: '1px solid #333' }}
                      />
                    </td>
                    <td>
                      {currentPrice > 0 ? `$${currentPrice.toLocaleString()}` : 'N/A'}
                    </td>
                    <td>
                      {coinValue > 0
                        ? `$${coinValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : 'N/A'}
                    </td>
                    <td style={{ color: pnl >= 0 ? 'green' : 'red' }}>
                      {pnl !== 0
                        ? `$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '$0.00'}
                    </td>
                    <td>
                      <button onClick={() => handleSave(coin)}>Save</button>
                    </td>
                    <td>
                      <button onClick={() => handleDelete(coin.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* chart section */}
      {selectedCoin && (
        <div className="chart-container">
          <h2 className="section-heading">
            Price Chart for {selectedCoin.charAt(0).toUpperCase() + selectedCoin.slice(1)}
          </h2>
          {chartLoading ? (
            <p>Loading chart...</p>
          ) : chartData ? (
            <div style={{ width: '80%', margin: '0 auto' }}>
              <Line data={chartData} />
            </div>
          ) : (
            <p>No chart data available.</p>
          )}
        </div>
      )}

      {/* news section */}
      <div className="news-container">
        <h2 className="section-heading">Latest Crypto News</h2>
        {newsLoading && <p>Loading news...</p>}
        {newsError && <p style={{ color: 'red' }}>{newsError}</p>}
        {!newsLoading && !newsError && news.length === 0 && (
          <p>No news available at the moment.</p>
        )}
        {!newsLoading && !newsError && news.length > 0 && (
          <div className="news-list">
            {news.map((article, index) => (
              <div className="news-item" key={index}>
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-link">
                  <h3>{article.title}</h3>
                </a>
                <p className="news-source">
                  {article.source.name} - {new Date(article.publishedAt).toLocaleString()}
                </p>
                <p className="news-description">{article.description || ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
