<!DOCTYPE html>
<html>
  <head>
    <title>Users List</title>
    <link rel="stylesheet" href="/css/style.css">
  </head>
  <body>
    <h1>Users List</h1>
    <p class="error">{{msg}}</p>
    <table>
      <tbody>
    <tr>
      <th>User ID</th>
      <th>Name</th>
      <th>Email</th>
      <th>Roles</th>
      <th>Creation Date</th>
      <th>Update Date</th>
    </tr>
    {{#users}}
    <tr>
      <td>{{id}}</td>
      <td>{{firstName}} {{lastName}}</td>
      <td>{{email}}</td>
      <td>{{#roles}}{{name}}</br>{{/roles}}</td>
      <td>{{creationTime}}</td>
      <td>{{updateTime}}</td>
    </tr>
    {{/users}}
      </tbody>
    </table>
    <div class="scroll">
       {{#prev}}
       <a href="/users?{{prev}}" rel="prev">&lt;&lt;</a>
       {{/prev}}
       {{#next}}
       <a href="/users?{{next}}" rel="next">&gt;&gt;</a>
       {{/next}}
    </div>
    {{>footer}}
  </body>
</html>
