define(['dController', 'loginView', 'loginModel', 'css!/user/css/login.css'], function(dController, loginView, loginModel){
    var Controller = dController.extend({
        initialize: function(){
            var model = new loginModel(this, 'login'),
                view = new loginView({
                    model: model,
                    controller: this
                });

            this.model = model;
            this.view = view;
        }
    });

    return Controller;
});