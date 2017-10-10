const databaseURL = "https://agendas-1293.firebaseio.com";

const firebase = require("firebase-admin");

firebase.initializeApp({
  credential: firebase.credential.cert(require("./service-account.json")),
  databaseURL: databaseURL
});

firebase.database().ref("/agendas/-KtA9T2pGHbsTxVMuDQS").once("value").then(function(data) {
  var promise = Promise.resolve();
  data.forEach(function(agenda) {
    promise = promise.then(function() {
      console.log("Migrating agenda " + agenda.key);
      console.log("Migrating permissions (1/3)...");
      console.log("Getting permissions...");
      return firebase.database().ref("/permissions").child(agenda.key).once("value");
    }).then(function(permissions) {
      console.log("Converting permissions...");
      var newAgenda = {name: agenda.val().name, permissions: {}};
      permissions.forEach(function(permission) {
        newAgenda[permission.key] = true;
        if (permission.val() === "editor") {
          newAgenda.permissions[permission.key] = {
            manage: true,
            complete_tasks: true,
            edit_tags: true,
            edit_tasks: true
          };
        }
      });
      console.log("Saving permissions...");
      return firebase.firestore().collection("agendas").doc(agenda.key).set(newAgenda);
    }).then(function() {
      console.log("Migrating tags (2/3)...");
      console.log("Getting tags...");
      return firebase.database().ref("/categories/").child(agenda.key).once("value");
    }).then(function(tags) {
      console.log("Saving tags...");
      var promises = [];
      var tagsRef  = firebase.firestore().collection("agendas").doc(agenda.key).collection("tags");
      tags.forEach(function(tag) {
        promises.push(tagsRef.doc(tag.key).set(tag.val()));
      });
      return Promise.all(promises);
    }).then(function() {
      console.log("Migrating tasks (3/3)...");
      console.log("Getting tasks...");
      return firebase.database().ref("/tasks/").child(agenda.key).once("value");
    }).then(function(tasks) {
      console.log("Saving tasks...");
      var promises = [];
      var tasksRef = firebase.firestore().collection("agendas").doc(agenda.key).collection("tasks");
      tasks.forEach(function(data) {
        var task = data.val();
        task.completed = !!task.completed;
        task.deadline = task.deadline && new Date(task.deadline);
        task.repeatEnds = task.repeatEnds && new Date(task.repeatEnds);
        task.tags = (task.tags && Object.keys(task.tags).length > 0) ? task.tags : null;
        promises.push(tasksRef.doc(data.key).set(task));
      });
      return Promise.all(promises);
    }).then(function() {
      console.log("Migration of " + agenda.key + " complete.");
    });
  });
  return promise;
}).then(function() {
  process.exit(0);
}).catch(function(e) {
  console.log("Migration failed: " + e.stack);
  process.exit(1);
});
