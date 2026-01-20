import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, UserProfile } from './entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserProfile])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class UsersModule {}