export type Lang = 'en' | 'zh';

export const DEFAULT_LANG: Lang = 'en';

export const MESSAGES: Record<Lang, Record<string, string>> = {
  en: {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.search': 'Search',
    'nav.donate': 'Donate',

    // Common
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading...',

    // Watchlist
    'watchlist.add': 'Add to watchlist',
    'watchlist.remove': 'Remove from watchlist',

    // Footer / Branding
    'footer.resources': 'Resources',
    'footer.apiDocs': 'API Docs',
    'footer.helpCenter': 'Help Center',
    'footer.terms': 'Terms',
    'footer.rights': 'All rights reserved.',
    'branding.initiativeBy': 'Initiative by',

    // Search
    'search.addStock': 'Add stock',
    'search.placeholder': 'Search stocks...',
    'search.loadingStocks': 'Loading stocks...',
    'search.noResultsFound': 'No results found',
    'search.noStocksAvailable': 'No stocks available',
    'search.searchResults': 'Search results',
    'search.popularStocks': 'Popular stocks',

    // TradingView titles
    'home.marketOverview': 'Market Overview',
    'home.stockHeatmap': 'Stock Heatmap',
    'home.marketData': 'Market Data',
    'home.topStories': 'Top Stories',
    'home.myStocks': 'My Stocks',

    // Tabs
    'home.tab.financial': 'Financial',
    'home.tab.technology': 'Technology',
    'home.tab.services': 'Services',
    'home.tab.us': 'US',
    'home.tab.cnAshare': 'CN A-Share',

    // Table headers
    'table.name': 'Name',
    'table.value': 'Value',
    'table.change': 'Change',
    'table.chgPercent': 'Chg%',
    'table.open': 'Open',
    'table.high': 'High',
    'table.low': 'Low',
    'table.prev': 'Prev',

    // Buttons / links
    'btn.openTradingView': 'Open in TradingView',
    'btn.addToWatchlist': 'Add to Watchlist',
    'btn.removeFromWatchlist': 'Remove from Watchlist',

    // A-share (internal bars)
    'ashare.dataSourceHint': 'Data source: baostock (minutes: 5/15/30/60) · 1m pending TuShare rt_min',
    'ashare.freq.1m': '1m',
    'ashare.freq.5m': '5m',
    'ashare.freq.15m': '15m',
    'ashare.freq.30m': '30m',
    'ashare.freq.60m': '60m',
    'ashare.freq.1d': '1D',
    'ashare.freq.1mDisabledHint': '1m data requires TuShare rt_min (enable later)',

    // Auth
    'auth.signIn': 'Sign in',
    'auth.signUp': 'Sign up',
    'auth.signOut': 'Sign out',

    // Signup form
    'signup.title': 'Create your account',
    'signup.fullName': 'Full name',
    'signup.email': 'Email',
    'signup.password': 'Password',
    'signup.country': 'Country/Region',
    'signup.investmentGoals': 'Investment goals',
    'signup.riskTolerance': 'Risk tolerance',
    'signup.preferredIndustry': 'Preferred industry',
    'signup.submit': 'Create account',
    'signup.haveAccount': 'Already have an account?',
    'signup.signInLink': 'Sign in',
    'signup.required': 'This field is required',

    // Goals
    'signup.goal.growth': 'Growth',
    'signup.goal.income': 'Income',
    'signup.goal.preservation': 'Capital preservation',

    // Risk
    'signup.risk.low': 'Low',
    'signup.risk.moderate': 'Moderate',
    'signup.risk.high': 'High',

    // Industry
    'signup.industry.technology': 'Technology',
    'signup.industry.healthcare': 'Healthcare',
    'signup.industry.finance': 'Finance',
    'signup.industry.consumer': 'Consumer',
    'signup.industry.energy': 'Energy',
    'signup.industry.industrial': 'Industrial',
    'signup.industry.realEstate': 'Real estate',
    'signup.industry.utilities': 'Utilities',
    'signup.industry.materials': 'Materials',
    'signup.industry.communication': 'Communication',

    // Country select
    'country.selectPlaceholder': 'Select a country/region...',
    'country.searchPlaceholder': 'Search countries/regions...',
    'country.noResults': 'No countries/regions found.',
    'country.required': 'Please select a country/region',
    'country.helper': 'Used to provide more relevant market information by region.',
  },

  zh: {
    // Nav
    'nav.dashboard': '仪表盘',
    'nav.search': '搜索',
    'nav.donate': '捐助',

    // Common
    'common.close': '关闭',
    'common.confirm': '确认',
    'common.cancel': '取消',
    'common.loading': '加载中...',

    // Watchlist
    'watchlist.add': '加入自选',
    'watchlist.remove': '移除自选',

    // Footer / Branding
    'footer.resources': '资源',
    'footer.apiDocs': 'API 文档',
    'footer.helpCenter': '帮助中心',
    'footer.terms': '服务条款',
    'footer.rights': '保留所有权利。',
    'branding.initiativeBy': '发起：',

    // Search
    'search.addStock': '添加股票',
    'search.placeholder': '搜索股票...',
    'search.loadingStocks': '正在加载股票...',
    'search.noResultsFound': '未找到结果',
    'search.noStocksAvailable': '暂无可用股票',
    'search.searchResults': '搜索结果',
    'search.popularStocks': '热门股票',

    // TradingView titles
    'home.marketOverview': '市场概览',
    'home.stockHeatmap': '股票热力图',
    'home.marketData': '市场数据',
    'home.topStories': '热门资讯',
    'home.myStocks': '我的股票',

    // Tabs
    'home.tab.financial': '金融',
    'home.tab.technology': '科技',
    'home.tab.services': '服务',
    'home.tab.us': '美股',
    'home.tab.cnAshare': 'A股',

    // Table headers
    'table.name': '名称',
    'table.value': '价格',
    'table.change': '涨跌',
    'table.chgPercent': '涨跌幅',
    'table.open': '开盘',
    'table.high': '最高',
    'table.low': '最低',
    'table.prev': '昨收',

    // Buttons / links
    'btn.openTradingView': '在 TradingView 打开',
    'btn.addToWatchlist': '加入自选',
    'btn.removeFromWatchlist': '移除自选',

    // A-share (internal bars)
    'ashare.dataSourceHint': '数据源：baostock（分钟：5/15/30/60） · 1分等待 TuShare rt_min',
    'ashare.freq.1m': '1分',
    'ashare.freq.5m': '5分',
    'ashare.freq.15m': '15分',
    'ashare.freq.30m': '30分',
    'ashare.freq.60m': '60分',
    'ashare.freq.1d': '日K',
    'ashare.freq.1mDisabledHint': '1分钟数据需要 TuShare rt_min（后续开通）',

    // Auth
    'auth.signIn': '登录',
    'auth.signUp': '注册',
    'auth.signOut': '退出登录',

    // Signup form
    'signup.title': '创建账号',
    'signup.fullName': '姓名',
    'signup.email': '邮箱',
    'signup.password': '密码',
    'signup.country': '国家/地区',
    'signup.investmentGoals': '投资目标',
    'signup.riskTolerance': '风险偏好',
    'signup.preferredIndustry': '偏好行业',
    'signup.submit': '创建账号',
    'signup.haveAccount': '已有账号？',
    'signup.signInLink': '去登录',
    'signup.required': '必填项',

    // Goals
    'signup.goal.growth': '成长',
    'signup.goal.income': '收益',
    'signup.goal.preservation': '保守',

    // Risk
    'signup.risk.low': '低',
    'signup.risk.moderate': '中',
    'signup.risk.high': '高',

    // Industry
    'signup.industry.technology': '科技',
    'signup.industry.healthcare': '医疗',
    'signup.industry.finance': '金融',
    'signup.industry.consumer': '消费',
    'signup.industry.energy': '能源',
    'signup.industry.industrial': '工业',
    'signup.industry.realEstate': '房地产',
    'signup.industry.utilities': '公用事业',
    'signup.industry.materials': '原材料',
    'signup.industry.communication': '通信',

    // Country select
    'country.selectPlaceholder': '请选择国家/地区...',
    'country.searchPlaceholder': '搜索国家/地区...',
    'country.noResults': '未找到国家/地区。',
    'country.required': '请选择国家/地区',
    'country.helper': '用于按地区提供更贴合的市场信息。',
  },
};
