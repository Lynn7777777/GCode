/**
 * H5 页面主要功能处理器
 *
 * 1. 监听，控制 url跳转
 * 2. Page的加载与切换
 * 3. Page的history控制
 */

define(['dInherit', 'dPageCache', 'dUrl', 'dGuid'], function (dInherit, dPageCache, dUrl, dGuid) {

    var AbstractApp = dInherit({
        __propertys__: function () {
            // 视图集
            this.pageCache = new dPageCache();

            // sub view-port公共容器
            this.mainframe;

            this.curController;

            this.lastController;

            // view 切换动画
            this.switchAnimation;
        },

        initialize: function (options) {
            $.extend(this, options || {});

            this.bindEvent();

            this.forward(location.href);
        },

        /**
         * 监听a链接跳转
         */
        bindEvent: function(){
            $('body').on('click', $.proxy(function (e) {
                    var el = $(e.target);
                    var needhandle = false;

                    while (true) {
                        if (!el[0]) {
                            break;
                        }
                        if (el[0].nodeName == 'BODY') {
                            break;
                        }
                        if (el.hasClass('sub-viewport')) {
                            break;
                        }

                        if (el[0].nodeName == 'A') {
                            needhandle = true;
                            break;
                        }
                        el = el.parent();
                    }

                    if (needhandle) {
                        this.forward(el.attr('href'));
                    }
                }, this));
        },

        /**
         * 通过监听到跳转url, 来解析渲染目标view
         * @param url
         * @param opt
         */
        loadViewFromUrl: function(url, opt){
            var self = this;

            require(['text!' + url], function(html){
                self.loadView(self._collectPageOption(html), url, opt.action);
            });
        },

        /**
         * 获取 page html
         * 获取controller, viewname, tpl, page title
         * 通过获取到的数据 来加载controller js
         *
         * @param html
         * @private
         */
        _collectPageOption: function(html){
            var pageDom = $(html),
                config = JSON.parse(pageDom.filter('script[type="text/config"]').html()),
                title = pageDom.filter('title').html(),
                tpl = {};

            pageDom.filter('script[type="text/tpl"][id]').map(function(i ,script) {
                tpl[script.id] = script.innerHTML.trim();
            });

            return {
                controllerPath: config.controller,
                viewName: config.viewName,
                tpl: tpl,
                title: title
            };
        },

        loadView: function(opt, path, action){
            var self = this,
                controllerPath = opt.controllerPath,
                ctrl;

//            this._freshUrlAndTitle(opt.title, path, action);

            // 现有取缓存中的

            ctrl = this.pageCache.getPageByPath(controllerPath);

            if(ctrl == null) {
                require([controllerPath], function (ctrl) {
                    self._handlerCntroller(ctrl, path, opt.viewName, opt.tpl, action);
                });
            }
            else {
                this._handlerCntroller(ctrl, path, opt.viewName, opt.tpl, action);
            }
        },

        /**
         * controller 加载成功后, 做的操作
         *
         * 当前 controller 切换
         * 给controller.view 注入模板 和 viewname
         * cache controller
         *
         *
         *
         * @param controller
         * @param path
         * @param viewName
         * @param tpl
         * @param action
         * @private
         */
        _handlerCntroller: function(controller, path, viewName, tpl, action){
            // controller 互换
            if( this.curController) {
                this.lastController = this.curController;
            }
            this.curController =  new controller();

            // 将template 注入目标view, 以供其调用
            this.curController.view.viewName = viewName;
            this.curController.view.T = tpl;

            // 存储view cache
            this.pageCache[action](this.curController.view.viewName, path, this.curController);

            this._createViewPort();
            this._switchView();
        },

        _switchView: function(){
            if(this.lastController) {
                // 执行lastview.onHide
                this.lastController.hide();
                this.lastController.view.$el.hide();
            }

            // curview 已构造，仅执行reload
            this.curController.load();
            this.curController.view.$el.show();
        },

        /**
         * 更改history url
         * @param title
         * @param path
         * @param action
         * @private
         */
        _freshUrlAndTitle: function(title, path, action){
            var url = location.protocol + '//' + location.host + '/' + path,
                noSuffixPath = this._getRootAbsolutePathWithoutSuffix(path);



            if(action === 'forward'){
                history.pushState({
                    title: title,
                    url: url,
                    path: noSuffixPath,
                    action: action
                }, title, noSuffixPath);
            } else if(action === 'back'){
                history.replaceState({
                    title: title,
                    url: url,
                    path: noSuffixPath,
                    action: action
                }, title, noSuffixPath);
            }
        },

        /**
         * 创建view port container
         * view.$el 存在: 则无需构建新的dom
         */
        _createViewPort: function () {
            if(this.curController.view.$el.parent().length) return;

            var mainViewHtml = '<div class="main-viewport"></div>',
                subViewId = this.curController.view.viewName + '_' + dGuid.newGuid(),
                subViewHtml = _.template('<div style="display: none" class="sub-viewport" id="<%=id%>" data-idx="<%=idx%>"></div>')({
                    id: subViewId,
                    idx: this.pageCache.length()
                }),
                container = $('#main');

            // 在第一次创建view前，先构建subview容器
            if(!this.mainframe || !this.mainframe.length){
                container.html(mainViewHtml);

                this.mainframe = $('.main-viewport');
            }

            this.mainframe.append(subViewHtml);

            this.curController.view.el = (this.curController.view.$el = $('#' + subViewId))[0];
            // 创建好view dom后触发controller create函数
            this.curController.create();
        },

        forward: function (url) {
           this.directTo(url, {action: 'forward'});

            Ancients &&! Ancients.forward && (Ancients.forward = $.proxy(arguments.callee, this));
        },

        back: function (url) {
            this.directTo(url, {action: 'back'});

            Ancients &&! Ancients.back && (Ancients.back = $.proxy(arguments.callee, this));
        },

        /**
         * 跳转核心方法
         * @param url
         * @param opt history方向
         */
        directTo: function(url, opt){
            var currentPath = this._getRootAbsolutePath(location.href),
                targetPath = this._getRootAbsolutePath(url);

            // 如果goto的路径是当前url, 则什么都不做
            if(currentPath !== targetPath || !this.curController){
                this.loadViewFromUrl(targetPath, opt);
            }
        },

        /**
         * 跟目录下的 相对路径+文件名
         * @param url
         * @returns {*}
         * @private
         */
        _getRootAbsolutePath: function(url){
            var pathParams = dUrl.parseUrl(url),
                pathName = pathParams.pathname,
                filename = pathParams.filename;

            if(url.charAt(0) === '/'){
                pathName = url;
            } else{
                pathName = pathName.slice(0, pathName.lastIndexOf('/'));
            }

            pathName += '/' + filename;

            return pathName;
        },

        /**
         * 跟目录下的 相对路径 + 文件名(不带后缀)
         * @param url
         * @private
         */
        _getRootAbsolutePathWithoutSuffix: function(url){
            debugger;
            var params = dUrl.parseUrl(url),
                directory = params.directory,
                fileName = params.filename;

            return directory + fileName.split('.')[0];
        }

    });

    return AbstractApp;
});