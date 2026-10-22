import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TicketsModule } from './tickets/tickets.module';
import { SolutionsModule } from './solutions/solutions.module';
import { EquipmentModule } from './equipment/equipment.module';
import { EquipmentSoftsModule } from './equipment-softs/equipment-softs.module';
import { ContractsModule } from './contracts/contracts.module';
import { SitesModule } from './sites/sites.module';
import { TypeSupportsModule } from './type-supports/type-supports.module';
import { TeamsModule } from './teams/teams.module';
// update module
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    TypeSupportsModule,
    SitesModule,
    EquipmentModule,
    EquipmentSoftsModule,
    ContractsModule,
    SolutionsModule,
    TicketsModule,
    TeamsModule,
  ],
})
export class AppModule {}
