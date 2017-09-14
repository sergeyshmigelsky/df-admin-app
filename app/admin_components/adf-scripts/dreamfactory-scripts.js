/**
 * This file is part of DreamFactory (tm)
 *
 * http://github.com/dreamfactorysoftware/dreamfactory
 * Copyright 2012-2014 DreamFactory Software, Inc. <support@dreamfactory.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('dfScripts', ['ngRoute', 'dfUtility'])
    .constant('MODSCRIPTING_ROUTER_PATH', '/scripts')
    .constant('MODSCRIPTING_ASSET_PATH', 'admin_components/adf-scripts/')
    .constant('MODSCRIPTING_EXAMPLES_PATH', 'admin_components/adf-scripts/examples/')
    .config(['$routeProvider', 'MODSCRIPTING_ROUTER_PATH', 'MODSCRIPTING_ASSET_PATH',
        function ($routeProvider, MODSCRIPTING_ROUTER_PATH, MODSCRIPTING_ASSET_PATH) {
            $routeProvider
                .when(MODSCRIPTING_ROUTER_PATH, {
                    templateUrl: MODSCRIPTING_ASSET_PATH + 'views/main.html',
                    controller: 'ScriptsCtrl',
                    resolve: {
                        checkCurrentUser: ['UserDataService', '$location', '$q', function (UserDataService, $location, $q) {

                            var currentUser = UserDataService.getCurrentUser(),
                                defer = $q.defer();

                            // If there is no currentUser and we don't allow guest users
                            if (!currentUser) {

                                $location.url('/login');

                                // This will stop the route from loading anything
                                // it's caught by the global error handler in
                                // app.js
                                throw {
                                    routing: true
                                };
                            }

                            // There is a currentUser but they are not an admin
                            else if (currentUser && !currentUser.is_sys_admin) {

                                $location.url('/launchpad');

                                // This will stop the route from loading anything
                                // it's caught by the global error handler in
                                // app.js
                                throw {
                                    routing: true
                                };
                            }

                            defer.resolve();
                            return defer.promise;
                        }]
                    }
                });
        }])
    .run(['INSTANCE_URL', '$http', function (INSTANCE_URL, $http) {

    }])
    .controller('ScriptsCtrl', ['INSTANCE_URL', 'SystemConfigDataService', '$scope', '$rootScope', '$http', 'dfApplicationData', 'dfNotify', 'MODSCRIPTING_EXAMPLES_PATH',
        function (INSTANCE_URL, SystemConfigDataService, $scope, $rootScope, $http, dfApplicationData, dfNotify, MODSCRIPTING_EXAMPLES_PATH) {

            $scope.$parent.title = 'Scripts';
            $scope.sampleSelect = null;

            $scope.serviceTypeConfig = 'scripts';

            $scope.newScript = true;
            $scope.disableServiceLinkRefresh = true;
            $scope.selections = {
                "service": null
            };

            // Loosely defined script object for when a script is non-existent.
            var ScriptObj = function (name) {

                return {
                    name: name,
                    type: 'v8js',
                    content: '',
                    is_active: false,
                    allow_event_modification: false,
                    storage_service_id: null,
                    scm_repository: null,
                    scm_reference: null,
                    storage_path: null
                };
            };

            $scope.scriptSamplesSelect = function (type) {

                $scope.sampleSelect = type;
                $scope._loadSampleScript(type);
            };

            $scope.handleFiles = function (element) {

                var file = element.files && element.files[0];
                if (file) {
                    var reader = new FileReader();
                    reader.readAsText(file, "UTF-8");
                    reader.onload = function (evt) {
                        $scope.$apply(function() {
                            $scope.currentScriptObj.content = evt.target.result;
                        });
                    };
                    reader.onerror = function (evt) {
                    };
                }
            };

            $scope.handleGitFiles = function (data) {

                if (!data) {
                    return;
                }
                $scope.currentScriptObj.content = data;
                $scope.$apply();
            };

            $scope.githubModalShow = function () {

                $rootScope.$broadcast('githubShowModal', $scope.serviceTypeConfig);
            };

            $scope.isHostedSystem = SystemConfigDataService.getSystemConfig().is_hosted;

            // Sample Scripts
            $scope.samplesScripts = null;

            // load data
            // Allows for building of events dynamically on the client

            $scope.apiData = null;

            $scope.loadTabData = function() {

                $scope.dataLoading = true;

                // always load event scripts from server
                var primaryApis = ['event_script'];

                // only load these one time as they should not change as scripts are created/deleted
                // this is particularly important for 'event' as it can be slow when there are many services
                var secondaryApis = ['event', 'script_type', 'service_link'];

                // for primaryApis force refresh to always load from server
                dfApplicationData.getApiData(primaryApis, true).then(
                    function (response) {
                        var newApiData = {};
                        primaryApis.forEach(function(value, index) {
                            newApiData[value] = response[index].resource ? response[index].resource : response[index];
                        });
                        // loading from cache is ok for secondaryApis, unless the tab is just loaded ($scope.apiData === null)
                        // in that case load from server to pick up any new services, tables, etc
                        // when a script is created or deleted $scope.apiData will not be null and data comes from cache
                        dfApplicationData.getApiData(secondaryApis, ($scope.apiData === null)).then(
                            function (response) {
                                secondaryApis.forEach(function(value, index) {
                                    if (value === 'service_link') {
                                        newApiData[value] = response[index].services;
                                    } else {
                                        newApiData[value] = response[index].resource ? response[index].resource : response[index];
                                    }
                                    if (value === 'event') {
                                        // used for highlighting in ui
                                        newApiData['event_lookup'] = $scope.buildEventLookup(newApiData[value]);
                                    }
                                });
                                // all done
                                $scope.apiData = newApiData;
                            },
                            function (error) {
                                var messageOptions = {
                                    module: 'Scripts',
                                    provider: 'dreamfactory',
                                    type: 'error',
                                    message: 'There was an error loading data for the Scripts tab. Please try refreshing your browser and logging in again.'
                                };
                                dfNotify.error(messageOptions);
                            }
                        ).finally(function () {
                            $scope.dataLoading = false;
                        });
                    },
                    function (error) {
                        var messageOptions = {
                            module: 'Scripts',
                            provider: 'dreamfactory',
                            type: 'error',
                            message: 'There was an error loading data for the Scripts tab. Please try refreshing your browser and logging in again.'
                        };
                        dfNotify.error(messageOptions);
                        $scope.dataLoading = false;
                    }
                );
            };

            $scope.getRefreshEnable = function() {

                var type, enable = false;

                if ($scope.currentScriptObj && $scope.selections.service) {
                    type = $scope.selections.service.type;
                    if (type === 'github' || type === 'gitlab') {
                        if ($scope.currentScriptObj.scm_repository && $scope.currentScriptObj.scm_reference && $scope.currentScriptObj.storage_path) {
                            enable = true;
                        }
                    } else {
                        if ($scope.currentScriptObj.storage_path) {
                            enable = true;
                        }
                    }
                }

                return enable;
            };

            $scope.resetServiceLink = function () {

                $scope.currentScriptObj.scm_repository = null;
                $scope.currentScriptObj.scm_reference = null;
                $scope.currentScriptObj.storage_path = null;
            };

            $scope.checkScriptFileType = function() {
                var servicePath = $scope.currentScriptObj.storage_path;
                var scriptType = $scope.currentScriptObj.type;
                var error = '';
                var pathSeg = servicePath.split('.');
                var fileExt = pathSeg.pop();
                fileExt = (fileExt)? fileExt.toLowerCase() : false;



                if(!fileExt || (fileExt !== 'js' && fileExt !== 'php' && fileExt !== 'py' && fileExt !== 'txt')){
                    error = 'Invalid script file provided for service linking. Only supported files are .js, .php, .py, and .txt.';
                } else if (fileExt === 'txt') {
                    error = '';
                } else if ((scriptType === 'nodejs' || scriptType === 'v8js') && fileExt !== 'js'){
                    error = 'Invalid script selected for ' + scriptType + ' script type. Please select a file with .js extension.';
                } else if (fileExt !== 'php' && scriptType === 'php'){
                    error = 'Invalid script selected for ' + scriptType + ' script type. Please select a file with .php extension.';
                } else if (fileExt !== 'py' && scriptType === 'python'){
                    error = 'Invalid script selected for ' + scriptType + ' script type. Please select a file with .py extension.';
                }

                if(error !==''){
                    return new PNotify({
                        title: 'Scripts',
                        type: 'error',
                        text: error
                    });
                } else {
                    return 1;
                }
            };

            $scope.pullLatestScript = function () {

                var serviceName = $scope.selections.service.name;
                var serviceRepo = $scope.currentScriptObj.scm_repository;
                var serviceRef = $scope.currentScriptObj.scm_reference;
                var servicePath = $scope.currentScriptObj.storage_path;
                var fileTypeCheck = $scope.checkScriptFileType();
                if( fileTypeCheck !== 1){
                    return fileTypeCheck;
                }

                var url = INSTANCE_URL + '/api/v2/' + serviceName;

                if($scope.selections.service && ($scope.selections.service.type === 'github' || $scope.selections.service.type === 'gitlab')){
                    var params = {
                        path: servicePath,
                        branch: serviceRef,
                        content: 1
                    };
                    url = url + '/_repo/' + serviceRepo;
                } else {
                    url = url + '/' + servicePath;
                }

                $http({
                    method: 'GET',
                    url: url,
                    params: params
                }).then(
                    function (result) {

                        $http({
                            method:'DELETE',
                            url: INSTANCE_URL + '/api/v2/system/cache/_event/' + $scope.currentScriptObj.name
                        }).then(
                            function(rs){

                            },
                            function(err) {
                                console.log('Failed to clear even scipt cache.')
                            }
                        ).finally(function(){
                            $scope.currentScriptObj.content = result.data;

                            return new PNotify({
                                title: 'Scripts',
                                type: 'success',
                                text: 'Successfully pulled the latest script from source.'
                            });
                        });
                    },

                    function (error) {

                        return new PNotify({
                            title: 'Scripts',
                            type: 'error',
                            text: 'There was an error pulling the latest script from your service. Please make sure your service, path and permissions are correct and try again.'
                        });
                    }
                ).finally(function () {
                });
            };

            $scope.loadTabData();

            $scope.allowedScriptFormats = ['js','php','py', 'txt'];

            // Keep track of what's going on in the module
            $scope.currentServiceObj = null;
            $scope.currentResourceObj = null;
            $scope.currentEndpointObj = null;
            $scope.currentScriptObj = null;
            $scope.menuPathArr = [];

            // Stuff for the editor
            $scope.editor = null;
            $scope.isEditorClean = true;

            // PUBLIC API

            // expand a single generic endpoint to full list using parameter arrays

            $scope.explodeEndpoint = function (endpointName, parameter) {

                var endpoints = [endpointName];

                if (parameter !== null) {
                    if (endpointName.indexOf("{") >= 0 && endpointName.indexOf("}") >= 0) {
                        angular.forEach(parameter, function (paramArray, paramName) {
                            angular.forEach(paramArray, function (itemName) {
                                endpoints.push(endpointName.replace("{" + paramName + "}", itemName));
                            });
                        });
                    }
                }

                return endpoints;
            };

            // given a script name, allows an easy way to determine which service, resource, endpoint to highlight
            // this function should only be called once after each time event data is loaded

            $scope.buildEventLookup = function (eventData) {

                var newData = angular.copy(eventData);
                var lookupData = {}, lookupObj;

                angular.forEach(newData, function (resources, serviceName) {
                    angular.forEach(resources, function (resourceData, resourceName) {
                        angular.forEach(resourceData.endpoints, function (endpointName) {
                            lookupObj = {
                                'service': serviceName,
                                'resource': resourceName,
                                'endpoint': endpointName
                            };
                            lookupData[endpointName] = lookupObj;
                            if (resourceData.parameter !== null) {
                                if (endpointName.indexOf("{") >= 0 && endpointName.indexOf("}") >= 0) {
                                    angular.forEach(resourceData.parameter, function (paramArray, paramName) {
                                        angular.forEach(paramArray, function (itemName) {
                                            lookupData[endpointName.replace("{" + paramName + "}", itemName)] = lookupObj;
                                        });
                                    });
                                }
                            }
                        });
                    });
                });
                return lookupData;
            };

            // return true if there are any event scripts for this service

            $scope.highlightService = function (serviceName) {

                return $scope.apiData.event_script.some(function(scriptName) {
                    var event = $scope.apiData.event_lookup[scriptName];
                    if (event) {
                        if (event.service === serviceName) {
                            return true;
                        }
                    }
                    return false;
                });
            };

            // return true if there are any event scripts for this resource

            $scope.highlightResource = function (resourceName) {

                return $scope.apiData.event_script.some(function(scriptName) {
                    var event = $scope.apiData.event_lookup[scriptName];
                    if (event) {
                        return event.resource === resourceName;
                    }
                    return false;
                });
            };

            // return true if there are any event scripts for this endpoint

            $scope.highlightEndpoint = function (endpointName) {

                return $scope.apiData.event_script.some(function(scriptName) {
                    var event = $scope.apiData.event_lookup[scriptName];
                    if (event) {
                        return event.endpoint === endpointName;
                    }
                    return false;
                });
            };

            // return true if there is an event script with this name

            $scope.highlightExplodedEndpoint = function (endpointName) {

                return $scope.apiData.event_script.some(function(scriptName) {
                    return scriptName === endpointName;
                });
            };

            // select a service and display all resources for that service

            $scope.selectService = function (serviceName, resources) {

                $scope.menuPathArr.push(serviceName);
                $scope.currentServiceObj = {"name": serviceName, "resources": resources};
            };

            // select a resource and display all endpoints for that resource

            $scope.selectResource = function (resourceName, resource) {

                $scope.menuPathArr.push(resourceName);
                $scope.currentResourceObj = {"name": resourceName, "endpoints": resource.endpoints, "parameter": resource.parameter};
            };

            // select an endpoint and show exploded list of endpoints

            $scope.selectEndpoint = function (endpointName) {

                var endpoints;

                $scope.menuPathArr.push(endpointName);
                endpoints = $scope.explodeEndpoint(endpointName, $scope.currentResourceObj.parameter);
                $scope.currentEndpointObj = {"name": endpointName, "endpoints": endpoints};
            };

            $scope.getServiceById = function (id) {

                var matches = $scope.apiData['service_link'].filter(function(service){
                    return service.id === id;
                });
                if (matches.length === 0) {
                    return null;
                }
                return matches[0];
            };

            // load the editor

            $scope.setScript = function (scriptName) {

                $scope.menuPathArr.push(scriptName);

                var requestDataObj = {

                    name: scriptName,
                    params: {}
                };

                $http({
                    method: 'GET',
                    url: INSTANCE_URL + '/api/v2/system/event_script/' + requestDataObj.name,
                    params: requestDataObj.params
                }).then(
                    function (result) {
                        $scope.currentScriptObj = result.data;
                        $scope.newScript = false;
                        $scope.selections.service = $scope.getServiceById($scope.currentScriptObj.storage_service_id);
                        $scope.editor.session.setValue($scope.currentScriptObj.content);
                    },
                    function (reject) {
                        $scope.currentScriptObj = new ScriptObj(scriptName);
                        $scope.newScript = true;
                        $scope.selections.service = null;
                    }
                ).finally(
                    function () {
                        $scope.enableDisableRefresh();
                    }
                );
            };

            // save script to server

            $scope.saveScript = function () {

                if (!$scope.currentScriptObj.name) {
                    return;
                }
                var fileTypeCheck = $scope.checkScriptFileType();
                if( fileTypeCheck !== 1){
                    return fileTypeCheck;
                }

                // sanitize service link config before saving
                // send nulls not empty strings
                // if no service selected send null for everything

                // service to link to
                $scope.currentScriptObj.storage_service_id = ($scope.selections.service ? $scope.selections.service.id : null);

                // repo is allowed for github or gitlab, replace empty string with null
                if ($scope.selections.service &&
                    ($scope.selections.service.type === 'github' || $scope.selections.service.type === 'gitlab')) {
                    $scope.currentScriptObj.scm_repository = ($scope.currentScriptObj.scm_repository ? $scope.currentScriptObj.scm_repository : null);
                } else {
                    $scope.currentScriptObj.scm_repository = null;
                }

                // ref is allowed for github or gitlab, replace empty string with null
                if ($scope.selections.service &&
                    ($scope.selections.service.type === 'github' || $scope.selections.service.type === 'gitlab')) {
                    $scope.currentScriptObj.scm_reference = ($scope.currentScriptObj.scm_reference ? $scope.currentScriptObj.scm_reference : null);
                }  else {
                    $scope.currentScriptObj.scm_reference = null;
                }

                // path is allowed for any link service, replace empty string with null
                if ($scope.selections.service) {
                    $scope.currentScriptObj.storage_path = ($scope.currentScriptObj.storage_path ? $scope.currentScriptObj.storage_path : null);
                }  else {
                    $scope.currentScriptObj.storage_path = null;
                }

                $scope.currentScriptObj.content = $scope.editor.getValue();

                var requestDataObj = {

                    name: $scope.currentScriptObj.name,
                    params: {},
                    data: $scope.currentScriptObj
                };

                $http({
                    method: 'POST',
                    url: INSTANCE_URL + '/api/v2/system/event_script/' + requestDataObj.name,
                    params: requestDataObj.params,
                    data: requestDataObj.data
                }).then(
                    function (result) {

                        $scope.editor.session.getUndoManager().reset();
                        $scope.editor.session.getUndoManager().markClean();
                        $scope.isEditorClean = true;
                        $scope.newScript = false;

                        // Needs to be replaced with angular messaging
                        $(function () {
                            new PNotify({
                                title: 'Scripts',
                                type: 'success',
                                text: 'Script "' + $scope.currentScriptObj.name + '" saved successfully.'
                            });
                        });
                    },

                    function (reject) {

                        throw {
                            module: 'Scripts',
                            type: 'error',
                            provider: 'dreamfactory',
                            exception: reject
                        };
                    }
                ).finally(
                    function () {
                        $scope.loadTabData();
                    }
                );
            };

            // delete script from server

            $scope.deleteScript = function () {

                if (dfNotify.confirm('Delete ' + $scope.currentScriptObj.name + '?')) {

                    var requestDataObj = {

                        name: $scope.currentScriptObj.name,
                        params: {}
                    };

                    $http({
                        method: 'DELETE',
                        url: INSTANCE_URL + '/api/v2/system/event_script/' + requestDataObj.name,
                        params: requestDataObj.params
                    }).then(
                        function (result) {

                            // Needs to be replaced with angular messaging
                            $(function () {
                                new PNotify({
                                    title: 'Scripts',
                                    type: 'success',
                                    text: 'Script deleted successfully.'
                                });
                            });

                            $scope.menuPathArr.pop();
                            $scope.currentScriptObj = null;
                            $scope.editor.session.getUndoManager().reset();
                            $scope.editor.session.getUndoManager().markClean();
                        },

                        function (reject) {

                            throw {
                                module: 'Scripts',
                                type: 'error',
                                provider: 'dreamfactory',
                                exception: reject
                            };

                        }
                    ).finally(
                        function () {
                            $scope.loadTabData();
                        }
                    );
                }
            };

            // COMPLEX IMPLEMENTATION

            $scope._loadSampleScript = function (type) {

                var fileExt = '';
                var mode = '';

                switch (type) {
                    case 'node':
                        fileExt = 'node.js';
                        mode = 'javascript';
                        break;
                    case 'php':
                        fileExt = 'php';
                        mode = 'php';
                        break;
                    case 'python':
                        fileExt = 'py';
                        mode = 'python';
                        break;
                    case 'v8js':
                        fileExt = 'v8.js';
                        mode = 'javascript';
                        break;
                }

                var editor = ace.edit('ide_samples');

                editor.session.setMode({path: 'ace/mode/' + mode, inline: true});
                editor.setOptions({readOnly: true});

                $http.get(MODSCRIPTING_EXAMPLES_PATH + 'example.scripts.' + fileExt).then(
                    function (result) {
                        editor.session.setValue(result.data);
                    },
                    function (reject) {
                        dfNotify.error(reject)
                    }
                );
            };

            $scope.menuOpen = true;

            // PUBLIC API

            $scope.toggleMenu = function () {

                $scope.menuOpen = !$scope.menuOpen;
            };

            $scope.menuBack = function () {

                // Check if we have changed the script
                if (!$scope.isEditorClean) {

                    // Script has been changed.  Confirm close.
                    if (!$scope._confirmCloseScript()) {

                        return false;
                    } else {
                        $scope.editor.session.getUndoManager().reset();
                        $scope.editor.session.getUndoManager().markClean();
                        $scope.isEditorClean = true;
                    }
                }

                if ($scope.menuPathArr.length > 0) {
                    $scope.menuPathArr.pop();
                    $scope.currentScriptObj = null;
                }

                return true;
            };

            $scope.updateEditor = function (scriptType) {
                var mode = 'text';
                if (scriptType === 'nodejs' || scriptType === 'v8js') {
                    mode = 'javascript';
                } else if (scriptType) {
                    mode = scriptType;
                }
                ace.edit('ide').session.setMode('ace/mode/' + mode);
            };

            $scope.jumpTo = function (index) {

                while ($scope.menuPathArr.length - 1 !== index) {
                    $scope.menuBack();
                }
            };


            // PRIVATE API

            $scope._clearScriptEditor = function () {
                $scope.currentScriptObj = null;
                ace.edit('ide').session.setValue('');
            };

            // Confirm close with unsaved changes.
            $scope._confirmCloseScript = function () {

                return confirm('You have unsaved changes.  Close anyway?');
            };


            // COMPLEX IMPLEMENTATION

            $scope.$broadcast('script:loaded:success');


            // MESSAGES

            var watchGithubCredUser = $scope.$watch('githubModal.username', function (newValue, oldValue) {

                if (!newValue) return false;

                $scope.modalError = {
                    visible: false,
                    message: ''
                };
            });

            var watchGithubCredPass = $scope.$watch('githubModal.password', function (newValue, oldValue) {

                if (!newValue) return false;

                $scope.modalError = {
                    visible: false,
                    message: ''
                };
            });

            var watchGithubURL = $scope.$watch('githubModal.url', function (newValue, oldValue) {

                if (!newValue) return false;

                $scope.modalError = {
                    visible: false,
                    message: ''
                };

                if (newValue.indexOf('.js') > 0 ||
                    newValue.indexOf('.py') > 0 ||
                    newValue.indexOf('.php') > 0 ||
                    newValue.indexOf('.txt') > 0) {

                    var url = angular.copy($scope.githubModal.url);
                    var url_params = url.substr(url.indexOf('.com/') + 5);
                    var url_array = url_params.split('/');

                    var owner = url_array[0];
                    var repo = url_array[1];

                    var github_api_url = 'https://api.github.com/repos/' + owner + '/' + repo;

                    $http.get(github_api_url, {
                        headers: {
                            'X-DreamFactory-API-Key': undefined,
                            'X-DreamFactory-Session-Token': undefined
                        }
                    })
                    .then(function successCallback(response) {

                        $scope.githubModal.private = response.data.private;

                        $scope.modalError = {
                            visible: false,
                            message: ''
                        };
                    }, function errorCallback(response) {

                        if (response.status === 404) {
                            $scope.modalError = {
                                visible: true,
                                message: 'Error: The repository could not be found.'
                            };
                        }
                    });
                }
            });

            var watchCurrentScriptObj = $scope.$watchCollection('currentScriptObj', function (newValue, oldValue) {

                if (newValue) {
                    $scope.disableServiceLinkRefresh = !$scope.getRefreshEnable();
                }
            });

            var watchSelections = $scope.$watchCollection('selections', function (newValue, oldValue) {

                $scope.disableServiceLinkRefresh = !$scope.getRefreshEnable();
            });

            $scope.$on('$destroy', function (e) {

                watchGithubURL();
                watchGithubCredUser();
                watchGithubCredPass();
                watchCurrentScriptObj();
                watchSelections();
            });
        }])

    .directive('scriptSidebarMenu', ['MODSCRIPTING_ASSET_PATH', function (MODSCRIPTING_ASSET_PATH) {

        return {

            restrict: 'E',
            scope: false,
            templateUrl: MODSCRIPTING_ASSET_PATH + 'views/script-sidebar-menu.html',
            link: function (scope, elem, attrs) {}
        };
    }])

    .directive('dfAceSamplesSelect', ['INSTANCE_URL', 'MODSCRIPTING_ASSET_PATH', '$http', '$timeout', function (INSTANCE_URL, MODSCRIPTING_ASSET_PATH, $http, $timeout) {

        return {
            restrict: 'E',
            scope: {
                currentScript: '=?',
                isClean: '=?',
                viewer: '=?',
                scriptType: '=?'
            },
            templateUrl: MODSCRIPTING_ASSET_PATH + 'views/df-ace-samples.html',
            link: function (scope, elem, attrs) {
                scope.viewer = ace.edit('ide_samples');
            }
        };

    }])
    .directive('dfAceEditorScripting', ['INSTANCE_URL', 'MODSCRIPTING_ASSET_PATH', '$http', '$timeout', function (INSTANCE_URL, MODSCRIPTING_ASSET_PATH, $http, $timeout) {

        return {
            restrict: 'E',
            scope: {
                currentEditObj: '=?',
                isClean: '=?',
                editor: '=?',
                scriptType: '=?'
            },
            templateUrl: MODSCRIPTING_ASSET_PATH + 'views/df-ace-editor.html',
            link: function (scope, elem, attrs) {

                // PRIVATE API
                scope._setEditorInactive = function (stateBool) {

                    if (stateBool) {
                        scope.editor.setOptions({
                            readOnly: true,
                            highlightActiveLine: false,
                            highlightGutterLine: false
                        });
                        scope.editor.renderer.$cursorLayer.element.style.opacity = 0;
                    } else {
                        scope.editor.setOptions({
                            readOnly: false,
                            highlightActiveLine: true,
                            highlightGutterLine: true
                        });
                        scope.editor.renderer.$cursorLayer.element.style.opacity = 100;
                    }
                };

                scope._loadEditor = function (contents, mode, inactive) {

                    inactive = inactive || false;
                    //scope.editor && scope.editor.destroy();

                    scope.editor = ace.edit('ide');

                    if (mode === true) {
                        mode = 'json';
                    } else if (scope.scriptType && ['nodejs', 'v8js'].indexOf(scope.scriptType) !== -1) {
                        mode = 'javascript';
                    } else if (scope.scriptType) {
                        mode = scope.scriptType;
                    } else {
                        mode = 'text';
                    }

                    scope.editor.session.setMode("ace/mode/" + mode);

                    scope._setEditorInactive(inactive);

                    if(typeof contents === 'object'){
                        contents = JSON.stringify(contents);
                    }

                    scope.editor.session.setValue(contents);

                    scope.editor.focus();

                    scope.editor.on('input', function () {

                        scope.$apply(function () {
                            scope.isClean = scope.editor.session.getUndoManager().isClean();
                        });
                    });

                    scope.editor.on('blur', function () {
                        scope.$apply(function () {
                            try {
                                scope.currentEditObj = scope.editor.getValue();
                            } catch (e) {
                            }
                        });
                    });
                };

                // WATCHERS AND INIT
                var watchCurrentEditObj = scope.$watch('currentEditObj', function (newValue, oldValue) {

                    if (newValue === 'samples') return false;

                    if (!newValue === null || newValue === undefined) {
                        //Empty editor
                        scope._loadEditor('', false, false);
                        return false;
                    }

                    //There is content to load
                    scope._loadEditor(newValue, false, false);
                });

                scope.$on('$destroy', function (e) {

                    watchCurrentEditObj();
                    scope.editor.destroy();
                });

            }
        };
    }])

    .directive('dfScriptingLoading', [function() {
        return {
            restrict: 'E',
            template: "<div class='col-lg-12' ng-if='dataLoading'><span style='display: block; width: 100%; text-align: center; color: #A0A0A0; font-size: 50px; margin-top: 100px'><i class='fa fa-refresh fa-spin'></i></div>"
        };
    }]);