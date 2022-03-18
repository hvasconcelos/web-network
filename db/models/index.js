import { Sequelize } from "sequelize";

import * as DatabaseConfig from "../config";
import ChainEvents from "./chain-events.model";
import Developers from "./developer.model";
import Issues from "./issue.model";
import MergeProposals from "./mergeproposal";
import Network from "./network.model";
import PullRequests from "./pullRequest.model";
import Repositories from "./repositories.model";
import User from "./user";

const Database = { sequelize: null };

const sequelize = new Sequelize(
  DatabaseConfig.database,
  DatabaseConfig.username,
  DatabaseConfig.password,
  DatabaseConfig
);

Database.user = User;
Database.developer = Developers;
Database.issue = Issues;
Database.mergeProposal = MergeProposals;
Database.repositories = Repositories;
Database.pullRequest = PullRequests;
Database.chainEvents = ChainEvents;
Database.network = Network;

Object.values(Database).forEach((model) => {
  if (model?.init) {
    model.init(sequelize);
  }
});

Object.values(Database).forEach((model) => {
  if (model?.associate) {
    model.associate(sequelize.models);
  }
});

Database.sequelize = sequelize;

export default Database;
