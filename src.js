
if(typeof(angular)!="undefined"){
	
	var interceptor = angular.module("authInterceptor",[]);
	
	interceptor.factory('loginService', ['$http','$window',function($http, $window){
	    
	    return {
	        popup: function(deferred){
	           
	            //登录成功后需要执行的回调
	            $window.letItGo = function(){
	                deferred.resolve();
	                delete $window.letItGo;
	            };
				
				//显示登录UI
	            //__popupLogin();
	        }
	    };
	}]);
	
	interceptor.factory('authInterceptor', ['$q','$injector', function($q, $injector) {
	    return{
	        responseError: function(response) {
	            
	            //拦截登录验证401错误
	            if(response.status == 401){
	                var loginService = $injector.get('loginService');
	                var $http = $injector.get('$http');
	                var deferred = $q.defer();
	               
	                loginService.popup(deferred);
	                
	                //登录成功再次发起请求
	                return deferred.promise.then(function() {
	                     return $http(response.config);
	                });
	            }
	            else if(response.status == 403){
	            	top.showMsg("error","对不起,您没足够的权限访问!");
	            }
	            else if(response.status == 500){
	            	top.showMsg("error", response.data || "系统错误!");
	            }
	            else{
	                return response;
	            }
	        }
	    };
	
	}]);
	
	interceptor.config(['$httpProvider', function($httpProvider) {
	    $httpProvider.interceptors.push('authInterceptor');
	    $httpProvider.defaults.headers.common['X-Requested-With']="XMLHttpRequest";
	}]);
}


//jquery ajax
if(!window.__ajax){
	
	//拦截后需要重新发起求情的执行队列
	window.letItGoQueue = [];
	//override ajax 返回新的Deferred, 以便拦截401
	window.__ajax = $.ajax;
	$.ajax = function(){
		var jqXHR = null;
		if(arguments.length == 2)
			jqXHR = window.__ajax(arguments[0],arguments[1]);
		else
			jqXHR = window.__ajax(arguments[0]);
		
		jqXHR.__deferred = $.Deferred();
		jqXHR.__deferred.abort = jqXHR.abort;
		return jqXHR.__deferred;
	};
	
	$.ajaxPrefilter(function(options, originalOptions, jqXHR) {
	            
	    //保存请求设置,以便登录成功后继续之前的动作
	    jqXHR.$$settings = options;
	    
	    //重载success handler
	    var success = options.success;
		options.success = function(data, textStatus, jqXHR) {
			//继续执行原有的成功处理
	        if(typeof(success) === "function") 
	        	success(data, textStatus, jqXHR);
	        //resolve ajax promise
	        if(jqXHR.__deferred) //没有拦截时执行
	       		jqXHR.__deferred.resolve(data, textStatus, jqXHR);
	        else if(options.__deferred) //401拦截时执行
	       		options.__deferred.resolve(data, textStatus, jqXHR);
	    };
	    
	    //重载error handler
	    var error = options.error;
	    options.error = function(jqXHR, textStatus, errorThrown) {
	
	        // override error handling
	        if(jqXHR.status == 401){

	        	//加入再次请求队列
	        	window.letItGoQueue.push(function(){

	        		//再次发起之前的ajax请求
	            	jqXHR.$$settings.__deferred = jqXHR.__deferred;

					window.__ajax(jqXHR.$$settings);
	                
	                $.unblockUI();
				});
	        	
	            window.letItGo = function(){

	            	while(window.letItGoQueue.length){
						window.letItGoQueue.pop()();
					}

	                delete window.letItGo;
	            };
	            
	            //弹出登录框
	            __popupLogin(null, options.url);
	        }
	        else if(jqXHR.status == 403){
            	top.showMsg("error","对不起,您没足够的权限访问!");
            }
	        else if(jqXHR.status == 500){
            	top.showMsg("error", jqXHR.responseText || "系统错误!");
            }
	        else{
	        	//继续执行原有的错误处理
	        	if(typeof(error) === "function")
	            	error(jqXHR, textStatus, errorThrown);

	        	//reject ajax promise
	        	if(jqXHR.__deferred)
	        		jqXHR.__deferred.reject(jqXHR, textStatus, errorThrown);
	        }
	    };
	});

}