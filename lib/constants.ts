export const NAV_ITEMS = [
  { href: '/', labelKey: 'nav.dashboard' },
  { href: '/search', labelKey: 'nav.search' },
  // { href: '/watchlist', labelKey: 'nav.watchlist' },
];

// ✅ Finnhub/search 默认用到的热门股票列表（被 lib/actions/finnhub.actions.ts 引用）
export const POPULAR_STOCK_SYMBOLS = [
  'NVDA',
  'TSLA',
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'META',
  'NFLX',
  'ORCL',
  'CRM',
];

// （可选）如果项目其它地方也用到了默认 watchlist，最好也保留
export const DEFAULT_WATCHLIST_SYMBOLS = POPULAR_STOCK_SYMBOLS;

// Sign-up form select options
export const INVESTMENT_GOALS = [
  { value: 'Growth', labelKey: 'signup.goal.growth' },
  { value: 'Income', labelKey: 'signup.goal.income' },
  { value: 'Balanced', labelKey: 'signup.goal.balanced' },
  { value: 'Conservative', labelKey: 'signup.goal.conservative' },
];

export const RISK_TOLERANCE_OPTIONS = [
  { value: 'Low', labelKey: 'signup.risk.low' },
  { value: 'Medium', labelKey: 'signup.risk.medium' },
  { value: 'High', labelKey: 'signup.risk.high' },
];

export const PREFERRED_INDUSTRIES = [
  { value: 'Technology', labelKey: 'signup.industry.technology' },
  { value: 'Healthcare', labelKey: 'signup.industry.healthcare' },
  { value: 'Finance', labelKey: 'signup.industry.finance' },
  { value: 'Energy', labelKey: 'signup.industry.energy' },
  { value: 'Consumer Goods', labelKey: 'signup.industry.consumerGoods' },
];

export const ALERT_TYPE_OPTIONS = [
  { value: 'upper', label: 'Upper' },
  { value: 'lower', label: 'Lower' },
];

export const CONDITION_OPTIONS = [
  { value: 'greater', label: 'Greater than (>)' },
  { value: 'less', label: 'Less than (<)' },
];

// CN market convention: up=red, down=green
const TV_UP_COLOR = '#ef4444';
const TV_DOWN_COLOR = '#22c55e';

// TradingView Charts
export const MARKET_OVERVIEW_WIDGET_CONFIG = {
  colorTheme: 'dark',
  dateRange: '12M',
  locale: 'en',
  largeChartUrl: '',
  isTransparent: true,
  showFloatingTooltip: true,
  plotLineColorGrowing: TV_UP_COLOR,
  plotLineColorFalling: TV_DOWN_COLOR,
  gridLineColor: 'rgba(240, 243, 250, 0)',
  scaleFontColor: '#DBDBDB',
  belowLineFillColorGrowing: 'rgba(41, 98, 255, 0.12)',
  belowLineFillColorFalling: 'rgba(41, 98, 255, 0.12)',
  belowLineFillColorGrowingBottom: 'rgba(41, 98, 255, 0)',
  belowLineFillColorFallingBottom: 'rgba(41, 98, 255, 0)',
  symbolActiveColor: 'rgba(15, 237, 190, 0.05)',
  // Home page only keeps NVDA + TSLA for US, and adds 3 China A-shares.
  tabs: [
    {
      title: 'US',
      symbols: [
        { s: 'NASDAQ:NVDA', d: 'NVIDIA' },
        { s: 'NASDAQ:TSLA', d: 'Tesla' },
      ],
    },
    {
      title: 'CN A-Share',
      symbols: [
        { s: 'SZSE:002317', d: '众生药业 002317' },
        { s: 'SSE:600226', d: '亨通股份 600226' },
        { s: 'SSE:603516', d: '淳中科技 603516' },
      ],
    },
  ],
  support_host: 'https://www.tradingview.com',
  backgroundColor: '#141414',
  width: '100%',
  height: 600,
  showSymbolLogo: true,
  showChart: true,
};

export const HEATMAP_WIDGET_CONFIG = {
  // NOTE: Heatmap is not used on the home page anymore.
  // Keep config here in case other pages need it.
  dataSource: 'SPX500',
  blockSize: 'market_cap_basic',
  blockColor: 'change',
  grouping: 'sector',
  isTransparent: true,
  locale: 'en',
  symbolUrl: '',
  colorTheme: 'dark',
  exchanges: [],
  hasTopBar: false,
  isDataSetEnabled: false,
  isZoomEnabled: true,
  hasSymbolTooltip: true,
  isMonoSize: false,
  width: '100%',
  height: '600',
};

export const TOP_STORIES_WIDGET_CONFIG = {
  // Home page no longer uses Top Stories (it will show many US tickers).
  // Keep this config for other pages.
  displayMode: 'regular',
  feedMode: 'market',
  colorTheme: 'dark',
  isTransparent: true,
  locale: 'en',
  market: 'stock',
  width: '100%',
  height: '600',
};

export const MARKET_DATA_WIDGET_CONFIG = {
  title: 'Stocks',
  width: '100%',
  height: 600,
  locale: 'en',
  showSymbolLogo: true,
  colorTheme: 'dark',
  isTransparent: false,
  backgroundColor: '#0F0F0F',
  // Home page: keep only NVDA + TSLA for US, and add 3 China A-shares
  symbolsGroups: [
    {
      name: 'US',
      symbols: [
        { name: 'NASDAQ:NVDA', displayName: 'NVIDIA' },
        { name: 'NASDAQ:TSLA', displayName: 'Tesla' },
      ],
    },
    {
      name: 'CN A-Share',
      symbols: [
        { name: 'SZSE:002317', displayName: '002317' },
        { name: 'SSE:600226', displayName: '600226' },
        { name: 'SSE:603516', displayName: '603516' },
      ],
    },
  ],
};

// Home page mini cards
export const HOME_WATCHLIST = [
  { symbol: 'SZSE:002317', label: '002317' },
  { symbol: 'SSE:600226', label: '600226' },
  { symbol: 'SSE:603516', label: '603516' },
];

export const SYMBOL_INFO_WIDGET_CONFIG = (symbol: string) => ({
  symbol: symbol.toUpperCase(),
  colorTheme: 'dark',
  isTransparent: true,
  locale: 'en',
  width: '100%',
  height: 170,
});

export const CANDLE_CHART_WIDGET_CONFIG = (symbol: string) => ({
  allow_symbol_change: false,
  calendar: false,
  details: true,
  hide_side_toolbar: true,
  hide_top_toolbar: false,
  hide_legend: false,
  hide_volume: false,
  hotlist: false,
  interval: 'D',
  locale: 'en',
  save_image: false,
  style: 1,
  symbol: symbol.toUpperCase(),
  theme: 'dark',
  timezone: 'Etc/UTC',
  backgroundColor: '#141414',
  gridColor: '#141414',
  watchlist: [],
  withdateranges: false,
  compareSymbols: [],
  studies: [],
  overrides: {
    // CN market convention: up=red, down=green
    'mainSeriesProperties.candleStyle.upColor': TV_UP_COLOR,
    'mainSeriesProperties.candleStyle.downColor': TV_DOWN_COLOR,
    'mainSeriesProperties.candleStyle.borderUpColor': TV_UP_COLOR,
    'mainSeriesProperties.candleStyle.borderDownColor': TV_DOWN_COLOR,
    'mainSeriesProperties.candleStyle.wickUpColor': TV_UP_COLOR,
    'mainSeriesProperties.candleStyle.wickDownColor': TV_DOWN_COLOR,

    'mainSeriesProperties.hollowCandleStyle.upColor': TV_UP_COLOR,
    'mainSeriesProperties.hollowCandleStyle.downColor': TV_DOWN_COLOR,
    'mainSeriesProperties.hollowCandleStyle.borderUpColor': TV_UP_COLOR,
    'mainSeriesProperties.hollowCandleStyle.borderDownColor': TV_DOWN_COLOR,
    'mainSeriesProperties.hollowCandleStyle.wickUpColor': TV_UP_COLOR,
    'mainSeriesProperties.hollowCandleStyle.wickDownColor': TV_DOWN_COLOR,

    'mainSeriesProperties.heikinAshiStyle.upColor': TV_UP_COLOR,
    'mainSeriesProperties.heikinAshiStyle.downColor': TV_DOWN_COLOR,
    'mainSeriesProperties.heikinAshiStyle.borderUpColor': TV_UP_COLOR,
    'mainSeriesProperties.heikinAshiStyle.borderDownColor': TV_DOWN_COLOR,
    'mainSeriesProperties.heikinAshiStyle.wickUpColor': TV_UP_COLOR,
    'mainSeriesProperties.heikinAshiStyle.wickDownColor': TV_DOWN_COLOR,

    // Volume colors: 0=down, 1=up
    'volume.volume.color.0': TV_DOWN_COLOR,
    'volume.volume.color.1': TV_UP_COLOR,
  },

  width: '100%',
  height: 600,
});

export const BASELINE_WIDGET_CONFIG = (symbol: string) => ({
  allow_symbol_change: false,
  calendar: false,
  details: false,
  hide_side_toolbar: true,
  hide_top_toolbar: false,
  hide_legend: false,
  hide_volume: false,
  hotlist: false,
  interval: 'D',
  locale: 'en',
  save_image: false,
  style: 10,
  symbol: symbol.toUpperCase(),
  theme: 'dark',
  timezone: 'Etc/UTC',
  backgroundColor: '#141414',
  gridColor: '#141414',
  watchlist: [],
  withdateranges: false,
  compareSymbols: [],
  studies: [],
  overrides: {
    // CN market convention: up=red, down=green
    'mainSeriesProperties.candleStyle.upColor': TV_UP_COLOR,
    'mainSeriesProperties.candleStyle.downColor': TV_DOWN_COLOR,
    'mainSeriesProperties.candleStyle.borderUpColor': TV_UP_COLOR,
    'mainSeriesProperties.candleStyle.borderDownColor': TV_DOWN_COLOR,
    'mainSeriesProperties.candleStyle.wickUpColor': TV_UP_COLOR,
    'mainSeriesProperties.candleStyle.wickDownColor': TV_DOWN_COLOR,

    // Volume colors: 0=down, 1=up
    'volume.volume.color.0': TV_DOWN_COLOR,
    'volume.volume.color.1': TV_UP_COLOR,
  },
  width: '100%',
  height: 600,
});

export const TECHNICAL_ANALYSIS_WIDGET_CONFIG = (symbol: string) => ({
  symbol: symbol.toUpperCase(),
  colorTheme: 'dark',
  isTransparent: 'true',
  locale: 'en',
  width: '100%',
  height: 400,
  interval: '1h',
  largeChartUrl: '',
});

export const COMPANY_PROFILE_WIDGET_CONFIG = (symbol: string) => ({
  symbol: symbol.toUpperCase(),
  colorTheme: 'dark',
  isTransparent: 'true',
  locale: 'en',
  width: '100%',
  height: 440,
});

export const COMPANY_FINANCIALS_WIDGET_CONFIG = (symbol: string) => ({
  symbol: symbol.toUpperCase(),
  colorTheme: 'dark',
  isTransparent: 'true',
  locale: 'en',
  width: '100%',
  height: 800,
});
