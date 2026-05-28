import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: { name: 'match-list' }
    },
    {
      path: '/panel',
      component: () => import('@/views/Panel.vue'),
      children: [
        {
          path: '',
          name: 'panel',
          redirect: { name: 'match-list' }
        },
        {
          path: 'matches',
          name: 'match-list',
          component: () => import('@/views/MatchList.vue')
        },
        {
          path: 'game/:gameId',
          name: 'game-detail',
          component: () => import('@/views/GameDetail.vue')
        },
        {
          path: 'analysis',
          name: 'analysis',
          component: () => import('@/views/AnalysisView.vue')
        }
      ]
    }
  ]
})

export { router }
