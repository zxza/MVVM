class Compile {
    constructor(el, vm) {
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;

        if (this.el) {
            //如果这个元素能获取到 我们才开始编译
            //1.先把这些真实的DOM移入到内存中 fragment
            let fragment = this.node2fragment(this.el);
            //2.编译=> 提取想要的元素节点 v-model和文本节点
            this.compile(fragment);
            //把编译好的fragement塞回页面中
            this.el.appendChild(fragment);
        }
    }



    //专门写一些辅助方法
    isElementNode(node) {
        return node.nodeType === 1;
    }


    isDirective(name) {
        return name.includes('v-')
    }
    //核心的方法
    compileElement(node){
        //带v-model v-text
        let attrs = node.attributes;  //取出当前节点属性
        Array.from(attrs).forEach(attr => {
            //判断属性名字是不是包含v-
            let attrName = attr.name;
            if (this.isDirective(attrName)) {
                //取到对应的值放到节点中
                //node
                let expr = attr.value;
                let [,type] = attrName.split('-');
                console.log(type);
                CompileUtil[type](node,this.vm,expr)
            }
        })
    }

    compileText(node) {
        //带{{}}
        let expr = node.textContent; //取文本中的内容
        let reg = /\{\{([^}]+)\}\}/g;
        if (reg.test(expr)) {
            //node this.vm.$data text
            CompileUtil['text'](node, this.vm, expr)
        }
    }

    compile(fragment) {
        //需要递归
        let childNodes = fragment.childNodes;
        Array.from(childNodes).forEach(node => {
            if (this.isElementNode(node)) {
                //是元素节点，继续深入的检查  编译元素
                this.compileElement(node);
                this.compile(node);
            } else {
                //文本节点  编译文本
                this.compileText(node);
                this.compile(node);
            }
        })
    }

    node2fragment(el) { //需要将el中的内容全部放在内存中
        //文档碎片 内存中的dom节点
        let fragment = document.createDocumentFragment();
        let firstChild;
        while (firstChild = el.firstChild) {
            fragment.appendChild(firstChild);
        }
        return fragment; //内存中的节点
    }
}

CompileUtil = {
    getVal(vm,expr) {  //获取实例上对应的数据
        expr = expr.split('.'); //[a,v,c,s]
        return expr.reduce((prev,next) => {  //vm.$data.a
            return prev[next];
        },vm.$data)
    },
    getTextVal(vm,expr) { //获取编译文本之后的结果
        return expr.replace(/\{\{([^}]+)\}\}/g, (...arguments) => {
            return this.getVal(vm, arguments[1]);
        })
    },
    text(node,vm,expr){ //文本处理
        let updateFn = this.updater['textUpdater'];
        // "message.a" => [message,a] vm.$data.message.a
        let value = this.getTextVal(vm,expr);
        expr.replace(/\{\{([^}]+)\}\}/g, (...arguments) => {
            new Watcher(vm, arguments[1], (newValue) => {
                //如果数据变化了，文本节点需要重新获取以来更新文本中的值
                updateFn && updateFn(node, this.getTextVal(vm,expr));
            });
        })
        updateFn && updateFn(node,value);
    },
    setVal(vm,expr,value) {
        expr = expr.split('.');
        return expr.reduce((prev,next,currentIndex) => {
            if (currentIndex === expr.length-1) {
                return prev[next] = value;
            }
            return prev[next];
        },vm.$data)
    },
    model(node,vm,expr) { //输入框处理
        let updateFn = this.updater['modelUpdater'];
        //这里监控数据变化了  应该调用这个watch
        new Watcher(vm,expr,(newValue) => {
            //当值变化后会调用cb  将新的值传递过来
            updateFn && updateFn(node, this.getVal(vm, expr));
        });
        node.addEventListener('input',(e) =>{
            let newValue = e.target.value;
            this.setVal(vm,expr,newValue);
        })

        // "message.a" => [message,a] vm.$data.message.a
        updateFn && updateFn(node, this.getVal(vm,expr));
    },
    updater: {
        //文本更新
        textUpdater(node,value){
            node.textContent = value;
        },
        //模板更新
        modelUpdater(node, value){
            node.value = value;
        }
    }
}