const pages = [
  'pages/home/index',
  'pages/login/index',
  'pages/reports/index',
  'pages/reports/create/index',
  'pages/reports/detail/index',
  'pages/reports/edit/index',
  'pages/reports/export/index',
  'pages/reports/review/index',
  'pages/reports/reply/index',
  'pages/report-templates/list/index',
  'pages/report-templates/edit/index',
  'pages/report-templates/versions/index',
  'pages/report-templates/compare/index',
  'pages/projects/index',
  'pages/projects/detail/index',
  'pages/projects/create/index',
  'pages/projects/edit/index',
  'pages/projects/analytics/index',
  'pages/projects/timeline/index',
  'pages/customers/index',
  'pages/customers/analytics/index',
  'pages/customers/detail/index',
  'pages/customers/create/index',
  'pages/customers/edit/index',
  'pages/tasks/index',
  'pages/tasks/detail/index',
  'pages/tasks/create/index',
  'pages/tasks/assign/index',
  'pages/bids/index',
  'pages/bids/detail/index',
  'pages/teams/index',
  'pages/teams/members/index',
  'pages/teams/analytics/index',
  'pages/documents/index',
  'pages/documents/detail/index',
  'pages/profile/index',
  'pages/profile/edit/index',
  'pages/profile/security/index',
  'pages/system/accounts/index',
  'pages/system/logs/index',
  'pages/system/users/index',
  'pages/system/users/add/index',
  'pages/system/users/edit/index',
  'pages/system/users/detail/index',
  'pages/system/users/import/index',
  'pages/system/cleanup-history/index',
  'pages/system/roles/index',
  'pages/system/roles/add/index',
  'pages/system/roles/edit/index',
  'pages/system/roles/permissions/index',
  'pages/system/job-level-mapping/index',
  'pages/system/settings/index',
  'pages/leader/dashboard/index',
  'pages/leader/kpi-detail/index',
  'pages/leader/alerts/index',
  'pages/notifications/index'
]

//  To fully leverage TypeScript's type safety and ensure its correctness, always enclose the configuration object within the global defineAppConfig helper function.
export default defineAppConfig({
  pages,
  tabBar: {
    color: '#8C8C8C',
    selectedColor: '#1D2B36',
    backgroundColor: '#FFFFFF',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: './assets/icons/home_unselected.png',
        selectedIconPath: './assets/icons/home_selected.png'
      },
      {
        pagePath: 'pages/reports/index',
        text: '工作汇报',
        iconPath: './assets/icons/reports_unselected.png',
        selectedIconPath: './assets/icons/reports_selected.png'
      },
      {
        pagePath: 'pages/projects/index',
        text: '项目管理',
        iconPath: './assets/icons/projects_unselected.png',
        selectedIconPath: './assets/icons/projects_selected.png'
      },
      {
        pagePath: 'pages/customers/index',
        text: '客户管理',
        iconPath: './assets/icons/customers_unselected.png',
        selectedIconPath: './assets/icons/customers_selected.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: './assets/icons/profile_unselected.png',
        selectedIconPath: './assets/icons/profile_selected.png'
      }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1D2B36',
    navigationBarTitleText: '施工企业市场经营管理',
    navigationBarTextStyle: 'white'
  }
})
