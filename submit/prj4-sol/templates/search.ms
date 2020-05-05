<!DOCTYPE html>
<html>
  <head>
    <title>User Search</title>
    <link rel="stylesheet" href="/css/style.css">
  </head>
  <body>
    <h1>Users Search</h1>
    {{#errors}}
          <p class="error">{{.}}</p>
    {{/errors}}
    <p>
      Please fill in one or more of the following fields
    </p>
    <form method="GET" action="/search/users">
      {{#fields}}
    	  {{#isSearch}}
    	    <label for={{id}}>{{friendlyName}}:</label>
    	    <div>
    	    <input name="{{name}}" id="{{id}}"
    	           value="{{value}}">
    	     <div class="error" {{#divError}}id="{{divError}}"{{/divError}}>{{errorMessage}}</div>
    	    </div>
    	  {{/isSearch}}
      {{/fields}}

      &nbsp;
      <input name="submit" type="submit" value="search" class="control">
    </form>
    {{>footer}}
    <script src="/js/user-id-chk.js"></script>
  </body>
</html>