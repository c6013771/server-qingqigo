import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { RequestsModule } from './modules/requests/requests.module';
import { HotListsModule } from './modules/hot-lists/hot-lists.module';
import { WeatherModule } from './modules/weather/weather.module';
import { SitesModule } from './modules/sites/sites.module';
import { NavCategoriesModule } from './modules/nav-categories/nav-categories.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    RedisModule,
    MailModule,
    AuthModule,
    UsersModule,
    FavoritesModule,
    RequestsModule,
    HotListsModule,
    WeatherModule,
    SitesModule,
    NavCategoriesModule,
  ],
})
export class AppModule {}
