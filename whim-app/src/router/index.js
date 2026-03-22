import { createRouter, createWebHistory } from 'vue-router'
import HomeView       from '@/views/HomeView.vue'
import SwipeView      from '@/views/SwipeView.vue'
import DetailView     from '@/views/DetailView.vue'
import ProfileView    from '@/views/ProfileView.vue'
import FavouritesView from '@/views/FavouritesView.vue'
import PlanView       from '@/views/PlanView.vue'
import PlanResultView from '@/views/PlanResultView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',            name: 'home',        component: HomeView },
    { path: '/swipe',       name: 'swipe',       component: SwipeView },
    { path: '/detail',      name: 'detail',      component: DetailView },
    { path: '/profile',     name: 'profile',     component: ProfileView },
    { path: '/favourites',  name: 'favourites',  component: FavouritesView },
    { path: '/plan',        name: 'plan',        component: PlanView },
    { path: '/plan-result', name: 'plan-result', component: PlanResultView },
  ],
})

export default router
