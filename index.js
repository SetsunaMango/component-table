'use strict';
/**
 * @author {mango}
 * 通用表格：
 * 1. 实现传入api自动渲染表单数据以及自动分页
 * 2. 在外部启用数据筛选方法 :filter()过滤器 !!! 
 * 3. this.method 获取传入的回掉函数以修正表单内容(注意this的指向)
 */
define([
    'zepto',
    './index.xtpl',
    'component/common-pager/pc/index'
], ($, xtpl, pagermod) => {
    class commonTable {
        /**
         * 构造器
         * @param {Object} options 参数配置
         * @param {Object} containner 容器(必选)
         * @param {string} title 表单标题
         * @param {string} headerCloum 表头(必选)
         * @param {json} query 表单配置(必选)
         * @param {json} page 分页器配置 
         * @param {boolean} lastPage 首页/尾页开关
         * @param {function} method 回调函数:外部模块调用方式:
         *      callback() {
                    let that = this; // 将this转化为jquery对象
                    return () => { // 闭包
                        that.method(); 
                    }
                }
         * @param {number} itemHeight 行高，关系到表单高度，影响分页器位置（默认为60）
         * @param {array} filters 如果需要在初始化时过滤数据则使用此参数传递过滤器 
         */
        constructor(options) {
            this.containner = typeof options.containner === 'string' ? $(options.containner) : options.containner;
            this.scope = {
                title: options.title || "",
                headerCloum: options.headerCloum || [],
                dataList: [],
                query: Object.assign({
                    api: null, // 数据接口地址 记得在地址末尾加上`？`
                    currentPage: 1, // 默认当前页数
                    pageSize: 5, // 每页数据量
                }, options.query),
                pager: Object.assign({
                    moreCount: 4, // 每组最大页数
                    hasInit: false, // 分页器开关,false为未加载(允许加载)
                    total: 0, // 总页数
                    stepTo: 10, // 总页数大于此值则出现跳转交互
                    lastPage: options.lastPage
                }, options.pager),
                NoData: Object.assign({
                    img: '',
                    text: '暂无数据',
                    height: 540
                }, options.NoData)
            }
            this.filters = options.filters || null;
            this.itemHeight = options.itemHeight || 60;
            this.method = options.method || null;
            this._init();
        }

        /**
         * 初始化
         */
        _init() {
            // 1.记录接口并初始化
            this.scope.query.api.charAt(this.scope.query.api.length - 1) === '?' ? this.api = this.scope.query.api : this.api = this.scope.query.api + '?';
            // 2.渲染表头
            this.containner.html(xtpl(this.scope));
            // 3.渲染表单
            if (this.scope.query.api) {
                this.loadData();
            } else {
                this.render();
            }
        }

        /**
         * 异步加载数据
         * ajax
         */
        loadData() {
            let api = this.scope.query.api;
            if (this.filters) {
                this.filterParams = this.filters; // 将过滤器传入表单
                api = `${this.api}`
                $.each(this.filterParams, (i, v) => {
                    api += `${v.field}=${v.value}&` // 放入接口地址
                });
                this.filters = null; // 仅触发一次
            }
            $.ajax({
                url: api,
                success: res => {
                    if (res.data && res.data.length > 0) {
                        this.data = res.data;
                        // 1.渲染表单
                        this.render(this.data);
                        this.scope.pager.total = Math.ceil(res.count / this.scope.query.pageSize); //总页数
                        // 2.渲染分页器
                        let pageOptions = { // 配置
                            // data: this.data || res,
                            scope: this.scope,
                            lastPage: this.scope.pager.lastPage
                        };
                        pageOptions.containner = this.containner.find('.pager');
                        if (!this.scope.pager.hasInit) {
                            this.pagermod = new pagermod(pageOptions); //渲染
                            if (this.scope.pager.total > 1) {
                                this.monitor(); // 监听键鼠事件
                            }
                            this.scope.pager.hasInit = true; // 防止分页器重复加载
                        }
                    } else {
                        this.renderNoData();
                        console.log('没有数据;api=' + this.scope.query.api);
                    }
                },
                error: err => {
                    this.renderNoData();
                    console.log('请求失败,请检查接口地址:'+this.scope.query.api);
                    throw new Error(err);
                }
            })

        }

        /**
         * 渲染表格
         * @param {Object} data 接口返回数据  
         */
        render(data) {
            // 1.数据判定
            if (data) {
                this.scope.dataList = data.data || data;
            } else {
                console.log('data is' + data);
            }
            // 2.数据渲染
            this.renderTable();
            if (typeof this.method === 'function') { // 渲染后启用回掉函数修正表单
                this.method();
            }
        }

        /**
         * 过滤筛选表单数据用这个!!!
         * @param {json} params 过滤//值为'reload'时 重载
         * @param {json} head 更新表头(增加或者减少表单字段)
         */
        filterData(params, head) {
            this.scope.pager.hasInit = false;
            if (head) { // 是否改动表头
                this.scope.headerCloum = head;
                this.containner.html(xtpl(this.scope));
            }
            if (params === 'reload') { // 传入reload 则重载
                this.filterParams = '';
                this.scope.query.api = this.api;
                this.loadData();
                return;
            }
            let api = this.api;
            let page = 1;
            if (this.pagermod) { //是否已加载分页器
                page = this.pagermod.export();
            }
            if (params) { // 是否更新过滤字段
                this.filterParams = params;
                page = 1;
            }
            if (this.filterParams) { // 是否过滤
                $.each(this.filterParams, (i, v) => {
                    api = `${this.api}${v.field}=${v.value}&`
                });
            }
            this.scope.query.currentPage = page;
            this.scope.query.api = `${api}pagesize=${this.scope.query.pageSize}&pageindex=${page}`;
            this.loadData();
        }

        /**
         * 渲染表格数据
         * @param 在headerCloum中传入class可添加类名(表中每行第一个类名默认为主键)
         */
        renderTable() {
            this.table = this.containner.find('.table tbody');
            // 1.渲染新数据前清空旧数据
            this.containner.find('.empty').remove();
            this.table.find('tr.item').remove();
            let dataList = this.scope.dataList;
            // 2.渲染新数据
            for (let i = 0; i < dataList.length && i < this.scope.query.pageSize; i++) {
                let item = dataList[i];
                let row = [];
                row.push(`<tr class="item">`);
                for (let j = 0; j < this.scope.headerCloum.length; j++) {
                    let h = this.scope.headerCloum[j];
                    if (j === 0) {
                        row.push(`<td class="${item.Id?item.Id:''}">${item[h.field]}</td>`);
                    } else {
                        row.push(`<td class="${h.class?item[h.class]?item[h.class]:h.class:''}">${item[h.field]}</td>`);
                    }
                }
                row.push(`</tr>`);
                this.table.append($(row.join('')))
            }
            // 3.分页器沉底 todo
            let fix = (this.scope.query.pageSize - this.containner.find('.item').length) * parseInt(this.itemHeight);
            this.fix = fix;
            this.containner.find('table.table').css('margin-bottom', fix + 'px');
        }

        /**
         * 监听分页器 todo 有问题
         */
        monitor() {
            this.containner.find('.page-box').off('click', 'li').on('click', 'li', () => { // 监听鼠标
                this.filterData();
            });

            this.containner.keyup(() => { // 监听键盘
                if (window.event.keyCode === 13) {
                    this.filterData();
                }
            })
        }

        /**
         * 取不到数据或取数据异常处理
         * to do: imporvement
         */
        renderNoData() {
            this.containner.find('table.table').css('margin-bottom', 0 + 'px');
            let img = ``;
            this.scope.NoData.img?img=`<img src="${this.scope.NoData.img}" style="width:80px;height:80px;">`:``;
            let noDataEl = $(`
                <div class="empty" style="display:flex;width:${this.containner.find('tr').width() || this.containner.width()}px;height:${this.fix || (this.scope.NoData.img?this.scope.NoData.height:this.scope.NoData.height/2)}px;">
                <div style="margin: auto ;width:80px;">
                    ${img}
                    <p style="width:80px;height:20px;line-height:20px;text-align:center;margin-top:20px;font-family: PingFangSC-Regular, Microsoft YaHei ,sans-serif ;font-size: 14px;color: #8893A6;">${this.scope.NoData.text}</p>
                </div>
            </div> `);
            // this.containner.find('table.table').css('margin-bottom', 0);
            this.containner.find('.pager').html('');
            this.containner.find('tr.item').remove();
            this.containner.find('.empty').remove();
            this.containner.find('.page-box').before(noDataEl);
            this.scope.pager.hasInit = false;
        }
    }
    return commonTable;
});
