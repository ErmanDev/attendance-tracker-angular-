import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { Home } from './pages/home/home';
import { About } from './pages/about/about';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { ClassroomDetail } from './pages/classroom-detail/classroom-detail';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'home', component: Home, canActivate: [authGuard] },
  {
    path: 'classroom/:id/attendance',
    loadComponent: () =>
      import('./pages/create-attendance/create-attendance').then((m) => m.CreateAttendance),
    canActivate: [authGuard],
  },
  { path: 'classroom/:id', component: ClassroomDetail, canActivate: [authGuard] },
  { path: 'about', component: About, canActivate: [authGuard] },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
