const appRoot = require('app-root-path');
const fs = require('fs');
const userListFilePath = `${appRoot}/user_list.json`;
const logger = require('../logger');
const users = require(userListFilePath);

async function synchronizeUserList() {
  logger.info('[USERS] Update user_list file, writing to file.');
  return fs.writeFileSync(userListFilePath, JSON.stringify(users, null, 2), 'utf-8');
}

// Register new users with some sane defaults
async function createUser(
  name, slackInfo, githubUsername,
  { requestable = true, merger = false, review_action = 'respond', notifications = true } = {}
) {
  const newUser = {
    name,
    slack: {
      name: slackInfo.name,
      id: slackInfo.id,
    },
    github: githubUsername,
    requestable,
    merger,
    review_action,
    notifications,
  };

  users.push(newUser);
  logger.info(`[USERS] New User created: ${JSON.stringify(newUser)}`);
  return await synchronizeUserList();
}

// Randomly select <numUsers> github users that are not <notMe>
async function selectRandomGithubUsersNot(notMe, numUsers = 1) {
  const usersToReturn = [];
  const excludedGithubNames = Array.isArray(notMe) ? notMe : [notMe];

  while (usersToReturn.length < numUsers) {
    // Select a random user that is not the one we passed based on github name
    const otherUsers = users.filter(current => {
      // Make sure its not themselves, and only people who are requestable
      return !excludedGithubNames.includes(current.github) && current.requestable;
    });
    if (otherUsers.length < 1) throw new Error('Not enough other users');

    const randomIndex = Math.floor(Math.random() * otherUsers.length);
    const selectedUser = otherUsers[randomIndex];
    usersToReturn.push(selectedUser);
    excludedGithubNames.push(selectedUser.github);
  }
  return usersToReturn;
}

// Look up a single user quickly or return null for easy comparisons
async function findByGithubName(name, logId) {
  if (!name) {
    logger.warn(`[users.findByGithubName:${logId}] Must pass name`);
    return null;
  }
  return users.find(element => element.github && element.github.toLowerCase() === name.toLowerCase()) || null;
}

// Look up a single user quickly or return null for easy comparisons
async function findBySlackUserId(slackId, logId) {
  if (!slackId) {
    logger.warn(`[users.findBySlackUserId:${logId}] Must pass slack id`);
    return null;
  }
  return users.find((element) => {
    return element.slack && element.slack.id && element.slack.id.toLowerCase() === slackId.toLowerCase();
  }) || null;
}

async function listBenchedUsers(onlyNames = false) {
  const filteredList = users.filter(user => !user.requestable);

  if (onlyNames) return filteredList.map(user => user.name);
  return filteredList;
}

async function listAvailableUsers(onlyNames = false) {
  const filteredList = users.filter(user => user.requestable);

  if (onlyNames) return filteredList.map(user => user.name);
  return filteredList;
}

async function listAllUsers() {
  return users;
}

async function filterUsers({ prop, val }) {
  return users.filter(user => user[prop] && user[prop] === val);
}

async function benchUserBySlackId(id, logId) {
  if (!id) return logger.info(`[users.benchUserBySlackId:${logId}] id required to bench user.`);
  let updated = false;

  users.map(user => {
    if (user.slack && user.slack.id.toLowerCase() === id.toLowerCase()) {
      user.requestable = false;
      updated = true;
    }
    return user;
  });
  await synchronizeUserList();
  if (updated) {
    logger.info(`[users.benchUserBySlackId:${logId}] Benched user: ${id}. user_list file`);
  } else {
    logger.info(`[users.benchUserBySlackId:${logId}] Could not find user ${id} to bench.`);
  }
  return updated;
}


async function activateUserBySlackId(id, logId) {
  if (!id) return logger.info(`[users.activateUserBySlackId:${logId}] id required to activate user.`);

  let updated = false;
  users.map(user => {
    if (user.slack && user.slack.id.toLowerCase() === id.toLowerCase()) {
      user.requestable = true;
      updated = true;
    }
    return user;
  });
  await synchronizeUserList();
  if (updated) {
    logger.info(`[users.activateUserBySlackId:${logId}] Benched user: ${id}. user_list file`);
  } else {
    logger.info(`[users.activateUserBySlackId:${logId}] Could not find user ${id} to bench.`);
  }
  return users;
}

async function muteNotificationsBySlackId(id, logId) {
  if (!id) return logger.info(`[users.muteNotificationsBySlackId:${logId}] id required to mute notifications.`);

  users.map(user => {
    if (user.slack && user.slack.id.toLowerCase() === id.toLowerCase()) {
      user.notifications = false;
    }
    return user;
  });
  await synchronizeUserList();
  logger.info('[USERS] Update user_list file');
  return users;
}

async function unmuteNotificationsBySlackId(id, logId) {
  if (!id) return logger.info(`[users.unmuteNotificationsBySlackId:${logId}] id needed to unmute notifications.`);

  users.map(user => {
    if (user.slack && user.slack.id.toLowerCase() === id.toLowerCase()) {
      user.notifications = true;
    }
    return user;
  });
  await synchronizeUserList();
  return users;
}

async function listAllUserNamesByAvailability() {
  const availableUsers = await listAvailableUsers(true);
  const benchedUsers = await listBenchedUsers(true);

  let availableUsersString = availableUsers.join();
  let benchedUsersString = benchedUsers.join();
  if (availableUsersString.length === 0) availableUsersString = 'None';
  if (benchedUsersString.length === 0) benchedUsersString = 'None';

  return {
    available: availableUsersString,
    benched: benchedUsersString,
  };
}

module.exports = {
  createUser,
  selectRandomGithubUsersNot,
  findByGithubName,
  findBySlackUserId,
  filterUsers,
  listAllUsers,
  listAllUserNamesByAvailability,
  listBenchedUsers,
  listAvailableUsers,
  benchUserBySlackId,
  activateUserBySlackId,
  muteNotificationsBySlackId,
  unmuteNotificationsBySlackId,
};
