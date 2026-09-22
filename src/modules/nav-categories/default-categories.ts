/**
 * 系统内置分类导航（与前端 src/data/sites.ts 的 categories 保持一致）。
 * 用户首次拉取分类时初始化为该用户的一份副本（isBuiltin=true），之后可自由编辑/删除，互不影响。
 */
export interface DefaultNavSite {
  name: string;
  url: string;
  desc?: string;
}

export interface DefaultNavCategory {
  label: string;
  sites: DefaultNavSite[];
}

export const defaultNavCategories: DefaultNavCategory[] = [
  {
    label: 'AI',
    sites: [
      { name: 'DeepSeek', url: 'https://chat.deepseek.com', desc: 'AI 助手' },
      { name: 'Kimi', url: 'https://www.kimi.com', desc: 'AI 助手' },
      { name: '豆包', url: 'https://www.doubao.com', desc: 'AI 助手' },
      { name: '通义千问', url: 'https://www.tongyi.com', desc: 'AI 助手' },
      { name: '腾讯元宝', url: 'https://yuanbao.tencent.com', desc: 'AI 助手' },
      { name: '文小言', url: 'https://yiyan.baidu.com', desc: 'AI 助手' },
      { name: '智谱清言', url: 'https://chatglm.cn', desc: 'AI 助手' },
      { name: '讯飞星火', url: 'https://xinghuo.xfyun.cn', desc: 'AI 助手' },
    ],
  },
  {
    label: '视频',
    sites: [
      { name: 'B站', url: 'https://www.bilibili.com', desc: '视频' },
      { name: '优酷', url: 'https://youku.com', desc: '视频' },
      { name: '爱奇艺', url: 'https://www.iqiyi.com', desc: '视频' },
      { name: '腾讯视频', url: 'https://v.qq.com', desc: '视频' },
      { name: '芒果TV', url: 'https://www.mgtv.com', desc: '视频' },
      { name: '抖音', url: 'https://www.douyin.com', desc: '短视频' },
      { name: '快手', url: 'https://www.kuaishou.com', desc: '短视频' },
    ],
  },
  {
    label: '音乐',
    sites: [
      { name: '网易云音乐', url: 'https://music.163.com', desc: '音乐' },
      { name: 'QQ音乐', url: 'https://y.qq.com', desc: '音乐' },
      { name: '酷狗音乐', url: 'https://www.kugou.com', desc: '音乐' },
      { name: '酷我音乐', url: 'https://www.kuwo.cn', desc: '音乐' },
      { name: '咪咕音乐', url: 'https://music.migu.cn', desc: '音乐' },
      { name: 'Apple Music', url: 'https://music.apple.com', desc: '音乐' },
    ],
  },
  {
    label: '购物',
    sites: [
      { name: '淘宝', url: 'https://www.taobao.com', desc: '网购' },
      { name: '京东', url: 'https://www.jd.com', desc: '网购' },
      { name: '拼多多', url: 'https://www.pinduoduo.com', desc: '网购' },
      { name: '天猫', url: 'https://www.tmall.com', desc: '网购' },
      { name: '闲鱼', url: 'https://www.goofish.com', desc: '闲置交易' },
      { name: '什么值得买', url: 'https://www.smzdm.com', desc: '导购' },
    ],
  },
  {
    label: '出行',
    sites: [
      { name: '携程', url: 'https://www.ctrip.com', desc: '机酒火车票' },
      { name: '12306', url: 'https://www.12306.cn', desc: '火车票' },
      { name: '飞猪', url: 'https://www.fliggy.com', desc: '机酒旅游' },
      { name: '去哪儿', url: 'https://www.qunar.com', desc: '机酒旅游' },
      { name: '高德地图', url: 'https://www.amap.com', desc: '地图' },
      { name: '百度地图', url: 'https://map.baidu.com', desc: '地图' },
    ],
  },
  {
    label: '办公',
    sites: [
      { name: '腾讯文档', url: 'https://docs.qq.com', desc: '在线文档' },
      { name: '钉钉', url: 'https://www.dingtalk.com', desc: '协作办公' },
      { name: '企业微信', url: 'https://work.weixin.qq.com', desc: '协作办公' },
      { name: '石墨文档', url: 'https://shimo.im', desc: '在线文档' },
      { name: '语雀', url: 'https://www.yuque.com', desc: '知识库' },
      { name: 'WPS', url: 'https://www.wps.cn', desc: '办公套件' },
      { name: '飞书', url: 'https://www.feishu.cn', desc: '协作办公' },
      { name: '腾讯会议', url: 'https://meeting.tencent.com', desc: '视频会议' },
    ],
  },
  {
    label: '邮箱',
    sites: [
      { name: 'QQ邮箱', url: 'https://mail.qq.com', desc: '邮箱' },
      { name: '163邮箱', url: 'https://mail.163.com', desc: '邮箱' },
      { name: '126邮箱', url: 'https://mail.126.com', desc: '邮箱' },
      { name: '139邮箱', url: 'https://mail.10086.cn', desc: '邮箱' },
      { name: 'Outlook', url: 'https://outlook.live.com', desc: '邮箱' },
      { name: '新浪邮箱', url: 'https://mail.sina.com.cn', desc: '邮箱' },
      { name: '阿里云邮箱', url: 'https://mail.aliyun.com', desc: '邮箱' },
    ],
  },
  {
    label: '工具',
    sites: [
      { name: '百度网盘', url: 'https://pan.baidu.com', desc: '网盘' },
      { name: '夸克网盘', url: 'https://pan.quark.cn', desc: '网盘' },
      { name: '百度翻译', url: 'https://fanyi.baidu.com', desc: '翻译' },
      { name: '有道翻译', url: 'https://fanyi.youdao.com', desc: '翻译' },
      { name: 'ProcessOn', url: 'https://www.processon.com', desc: '流程图' },
    ],
  },
  {
    label: '新闻',
    sites: [
      { name: '今日头条', url: 'https://www.toutiao.com', desc: '新闻' },
      { name: '澎湃新闻', url: 'https://www.thepaper.cn', desc: '新闻' },
      { name: '人民网', url: 'https://www.people.com.cn', desc: '新闻' },
      { name: '新浪新闻', url: 'https://news.sina.com.cn', desc: '新闻' },
      { name: '网易新闻', url: 'https://news.163.com', desc: '新闻' },
      { name: '凤凰新闻', url: 'https://news.ifeng.com', desc: '新闻' },
      { name: '腾讯新闻', url: 'https://news.qq.com', desc: '新闻' },
      { name: '36氪', url: 'https://36kr.com', desc: '科技资讯' },
    ],
  },
  {
    label: '财经',
    sites: [
      { name: '东方财富', url: 'https://www.eastmoney.com', desc: '财经' },
      { name: '雪球', url: 'https://xueqiu.com', desc: '投资社区' },
      { name: '天天基金', url: 'https://fund.eastmoney.com', desc: '基金' },
      { name: '财新', url: 'https://www.caixin.com', desc: '财经新闻' },
      { name: '华尔街见闻', url: 'https://wallstreetcn.com', desc: '财经资讯' },
      { name: '新浪财经', url: 'https://finance.sina.com.cn', desc: '财经' },
      { name: '同花顺', url: 'https://www.10jqka.com.cn', desc: '股票' },
    ],
  },
  {
    label: '知识',
    sites: [
      { name: '知乎', url: 'https://www.zhihu.com', desc: '问答社区' },
      { name: '微信读书', url: 'https://weread.qq.com', desc: '阅读' },
      { name: '得到', url: 'https://www.dedao.cn', desc: '知识服务' },
      { name: '豆瓣', url: 'https://www.douban.com', desc: '书影音' },
      { name: '中国大学MOOC', url: 'https://www.icourse163.org', desc: '在线课程' },
      { name: '简书', url: 'https://www.jianshu.com', desc: '创作社区' },
      { name: 'CSDN', url: 'https://www.csdn.net', desc: '技术社区' },
      { name: 'GitHub', url: 'https://github.com', desc: '代码托管' },
    ],
  },
  {
    label: '社交',
    sites: [
      { name: '小红书', url: 'https://www.xiaohongshu.com', desc: '生活分享' },
      { name: '微博', url: 'https://weibo.com', desc: '社交' },
      { name: '百度贴吧', url: 'https://tieba.baidu.com', desc: '兴趣社区' },
      { name: '抖音', url: 'https://www.douyin.com', desc: '短视频' },
      { name: '即刻', url: 'https://web.okjike.com', desc: '兴趣社区' },
      { name: '虎扑', url: 'https://www.hupu.com', desc: '体育社区' },
      { name: '脉脉', url: 'https://maimai.cn', desc: '职场社交' },
    ],
  },
];
