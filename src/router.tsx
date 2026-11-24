import { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext, createRoute, createRouter } from '@tanstack/react-router'
import { FullPageMessage } from './components/ui'
import { Admin } from './routes/Admin'
import { Home } from './routes/Home'
import { MyEntry } from './routes/MyEntry'
import { Signup } from './routes/Signup'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: () => <FullPageMessage title="Página não encontrada" />,
})

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home })
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: Admin })
const entryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$token',
  validateSearch: (s: Record<string, unknown>): { novo?: boolean } => (s.novo ? { novo: true } : {}),
  component: MyEntry,
})
const signupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/$slug', component: Signup })

const routeTree = rootRoute.addChildren([homeRoute, adminRoute, entryRoute, signupRoute])

export const router = createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
