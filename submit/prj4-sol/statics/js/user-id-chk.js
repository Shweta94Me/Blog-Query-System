(function () {
    let userId = document.getElementById('userId');
    let errorDiv = document.getElementById('userIdErr');
    userId.addEventListener('blur', async function f() {
        try{
            errorDiv.innerHTML = "";
            if(userId.value !== ""){
                const responseData = await fetch('/users?id=' + userId.value+ '&_json=true');
                const response = await responseData.json();
                if(response !== undefined && Object.keys(response).length > 0 && response.users.length === 0){
                    errorDiv.innerHTML = 'There is no user with id "'+ userId.value + '"';
                }
            }
        }
        catch (err) {
          console.log(err);
        }
    });
}());