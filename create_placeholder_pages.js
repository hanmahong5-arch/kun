const fs = require('fs');
const path = require('path');

const pages = [
  {path: 'reports/create', title: '填写周报'},
  {path: 'reports/detail', title: '周报详情'},
  {path: 'reports/review', title: '周报审阅'},
  {path: 'projects/detail', title: '项目详情'},
  {path: 'projects/create', title: '创建项目'},
  {path: 'customers', title: '客户管理'},
  {path: 'customers/detail', title: '客户详情'},
  {path: 'customers/create', title: '创建客户'},
  {path: 'tasks', title: '任务管理'},
  {path: 'tasks/detail', title: '任务详情'},
  {path: 'tasks/create', title: '创建任务'},
  {path: 'documents', title: '知识库'},
  {path: 'documents/detail', title: '文档详情'},
  {path: 'profile/edit', title: '编辑资料'},
  {path: 'profile/security', title: '账号安全'},
  {path: 'system/accounts', title: '账号管理'},
  {path: 'system/logs', title: '系统日志'},
  {path: 'data-reports', title: '数据报表'},
  {path: 'data-reports/config', title: '报表配置'},
  {path: 'data-reports/detail', title: '报表详情'},
  {path: 'notifications', title: '消息通知'}
];

pages.forEach(page => {
  const dir = path.join(__dirname, 'src/pages', page.path);
  const componentName = page.path.split('/').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Page';
  
  const indexContent = 'import Taro from \'@tarojs/taro\'\nimport {withRouteGuard} from \'@/components/RouteGuard\'\n\nfunction ' + componentName + '() {\n  return (\n    <div className="min-h-screen bg-background px-6 py-6">\n      <div className="bg-card rounded shadow-card p-12 flex flex-col items-center">\n        <div className="i-mdi-wrench text-[100px] text-muted-foreground" />\n        <div className="text-2xl text-foreground mt-4">' + page.title + '</div>\n        <div className="text-xl text-muted-foreground mt-2">功能开发中...</div>\n        <button\n          type="button"\n          onClick={() => Taro.navigateBack()}\n          className="mt-6 px-8 py-3 bg-primary text-primary-foreground text-xl rounded flex items-center justify-center leading-none">\n          返回\n        </button>\n      </div>\n    </div>\n  )\n}\n\nexport default withRouteGuard(' + componentName + ')\n';
  
  const configContent = 'export default definePageConfig({\n  navigationBarTitleText: \'' + page.title + '\',\n  enableShareAppMessage: true,\n  enableShareTimeline: true\n})\n';
  
  fs.writeFileSync(path.join(dir, 'index.tsx'), indexContent);
  fs.writeFileSync(path.join(dir, 'index.config.ts'), configContent);
  console.log('Created ' + page.path);
});

console.log('All placeholder pages created!');
