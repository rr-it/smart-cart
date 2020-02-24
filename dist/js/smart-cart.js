/*!
 * jQuery Smart Cart v3.0.6
 * The smart interactive jQuery Shopping Cart plugin with PayPal payment support
 * 
 * Licensed under the terms of the MIT License
 * https://github.com/tete-chercheuse/smart-cart/blob/master/LICENSE
 */

;(function ($, window, document, undefined) {
    "use strict";
    // Default options

    var defaults = {
        cart: [], // initial products on cart
        resultName: 'cart_list', // Submit name of the cart parameter
        theme: 'default', // theme for the cart, related css need to include for other than default theme
        combineProducts: true, // combine similar products on cart
        highlightEffect: true, // highlight effect on adding/updating product in cart
        cartItemTemplate: '<td class="sc-cart-item-name"><h4>{product_name}</h4><p>{product_desc}</p></td><td class="sc-cart-item-price">{product_price}</td><td class="sc-cart-item-quantity">{product_quantity}</td><td class="sc-cart-item-amount">{product_total}</td>',
        cartHeaderTemplate: '<th>Name</th><th>Price</th><th>Quantity</th><th>Total</th><th></th>',
        productContainerSelector: '.sc-product-item',
        productElementSelector: '*', // input, textarea, select, div, p
        addCartSelector: '.sc-add-to-cart',
        transitionsDuration: 300,
        quantityOptions: {
            min: 0,
            max: 1000,
            step: 1
        },
        paramSettings: { // Map the paramters
            productPrice: 'product_price',
            productTotal: 'product_total',
            productQuantity: 'product_quantity',
            productQuantityMin: 'product_quantity_min',
            productQuantityMax: 'product_quantity_max',
            productQuantityStep: 'product_quantity_step',
            productName: 'product_name',
            productId: 'product_id'
        },
        lang: { // Language variables
            cartTitle: "Shopping Cart",
            checkout: 'Checkout',
            clear: 'Clear',
            subtotal: 'Subtotal:',
            cartRemove: '×',
            cartEmpty: 'Cart is Empty'
        },
        storageSettings: {
            persistentCart: false, // Make cart persistent. Notice: If the given 'storageApi'-object is broken, the persistent cart is disabled.
            storageApi: localStorage, // Storage object: localStorage, sessionStorage or custom object implementing Web Storage API.
            storageKey: 'cart_list'
        },
        submitSettings: {
            submitType: 'form', // form, paypal, ajax
            ajaxURL: '', // Ajax submit URL
            ajaxSettings: {} // Ajax extra settings for submit call
        },
        currencySettings: {
            locales: 'en-US', // A string with a BCP 47 language tag, or an array of such strings
            currencyOptions: {
                style: 'currency',
                currency: 'USD',
                currencyDisplay: 'symbol' // extra settings for the currency formatter. Refer: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Number/toLocaleString
            }
        },
        toolbarSettings: {
            showToolbar: true,
            showCheckoutButton: true,
            showClearButton: true,
            showCartSummary: true,
            checkoutButtonStyle: 'default', // default, paypal, image
            checkoutButtonImage: '', // image for the checkout button
            toolbarExtraButtons: [] // Extra buttons to show on toolbar, array of jQuery input/buttons elements
        },
        debug: false
    };

    // The plugin constructor
    function SmartCart(element, options) {
        // Merge user settings with default, recursively
        this.options = $.extend(true, {}, defaults, options);
        // Cart array
        this.cart = [];
        // Cart element
        this.cartElement = $(element);
        // Call initial method
        this.init();
    }

    $.extend(SmartCart.prototype, {

        init: function () {
            var self = this;

            // Init persistent storage; on failure disable persistence.
            this._initStorageApi();

            // Set the elements
            this._setElements();

            // Add toolbar
            this._setToolbar();

            // Assign plugin events
            this._setEvents();

            if (this.options.storageSettings.persistentCart === true) {
                // Restore cart value from persistent storage
                var storageCart = JSON.parse(this._storageApi.getItem(this.options.storageSettings.storageKey));
                $(storageCart).each(function (i, p) {
                    self._addToCart(p);
                });
            }

            // Set initial products
            $(this.options.cart).each(function (i, p) {
                p = self._addToCart(p);
            });

            // Call UI sync
            this._hasCartChange();
        },

        // PRIVATE FUNCTIONS
        /* 
         * Set basic elements for the cart
         */
        _setElements: function () {
            // The element store all cart data and submit with form
            var cartListElement = $('<input type="hidden" name="' + this.options.resultName + '" id="' + this.options.resultName + '" />');
            this.cartElement.append(cartListElement);
            // Set the cart main element
            this.cartElement.addClass('sc-cart sc-theme-' + this.options.theme);
            this.cartElement.append('<div class="sc-cart-heading">' + this.options.lang.cartTitle + ' <span class="sc-cart-count">0</span></div>');
            this.cartElement.append('<table class="sc-cart-item-list"><thead>' + this.options.cartHeaderTemplate + '</thead><tbody></tbody></table>');
        },
        /* 
         * Set the toolbar for the cart 
         */
        _setToolbar: function () {
            if (this.options.toolbarSettings.showToolbar !== true) {
                return false;
            }

            var toolbar = $('<div></div>').addClass('sc-toolbar');
            var toolbarButtonPanel = $('<div class="sc-cart-toolbar">');
            var toolbarSummaryPanel = $('<div class="sc-cart-summary">');

            // Clear Button
            if (this.options.toolbarSettings.showClearButton) {
                var btnClear = $('<button class="sc-cart-clear" type="button">').text(this.options.lang.clear);
                toolbarButtonPanel.append(btnClear);
            }

            // Add extra toolbar buttons
            if (this.options.toolbarSettings.toolbarExtraButtons && this.options.toolbarSettings.toolbarExtraButtons.length > 0) {
                toolbarButtonPanel.append(this.options.toolbarSettings.toolbarExtraButtons);
            }

            // Checkout Button
            if (this.options.toolbarSettings.showCheckoutButton) {
                var btnCheckout = '';
                switch (this.options.toolbarSettings.checkoutButtonStyle) {
                    case 'paypal':
                        btnCheckout = '<button class="sc-button-checkout-paypal sc-cart-checkout" type="submit"><img src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/checkout-logo-medium.png" alt="Check out with PayPal" /></button>';
                        break;
                    case 'image':
                        btnCheckout = '<button class="sc-button-checkout-paypal sc-cart-checkout" type="submit"><img src="' + this.options.toolbarSettings.checkoutButtonImage + '" alt="Check out" /></button>';
                        break;
                    default:
                        btnCheckout = '<button class="sc-cart-checkout" type="button">' + this.options.lang.checkout + '</button> ';
                        break;
                }
                toolbarButtonPanel.append(btnCheckout);
            }

            // Cart Summary
            if (this.options.toolbarSettings.showCartSummary) {
                var panelSubTotal = $('<div class="sc-cart-summary-subtotal">');
                panelSubTotal.append(this.options.lang.subtotal).append(' <span class="sc-cart-subtotal">0</span>');
                toolbarSummaryPanel.append(panelSubTotal);
            }

            toolbar.append(toolbarSummaryPanel);
            toolbar.append(toolbarButtonPanel);
            this.cartElement.append(toolbar);
        },
        /* 
         * Set events for the cart
         */
        _setEvents: function () {
            var self = this;
            // Capture add to cart button events
            $(this.options.addCartSelector).on("click", function (e) {
                e.preventDefault();
                var p = self._getProductDetails($(this));
                p = self._addToCart(p);
                $(this).parents(self.options.productContainerSelector).addClass('sc-added-item').attr('data-product-unique-key', p.unique_key);
            });

            // Item remove event
            $(this.cartElement).on("click", '.sc-cart-remove', function (e) {
                e.preventDefault();
                $(this).parents('.sc-cart-item').fadeOut(self.options.transitionsDuration, function () {
                    self._removeFromCart($(this).data('unique-key'));
                    $(this).remove();
                    self._hasCartChange();
                });
            });

            // Item quantity change event
            $(this.cartElement).on("change input", '.sc-cart-item-qty', function (e) {
                e.preventDefault();

                var $input = $(e.currentTarget);
                // Get values from input box
                var step = $input.attr('step');
                var stepOrig = step;
                var new_qty = $input.val();
                var max = $input.attr('max');
                var min = $input.attr('min');

                var multiplier = function (number) {
                    var zeros = self._getDecimals(stepOrig);
                    var mult = "1";
                    for (var i = 0; i <= zeros; i++) mult = mult + "0";

                    return parseInt(mult);
                };

                // Adjust default values if values are blank
                if (min === '' || typeof min === 'undefined') {
                    min = 1;
                }

                if (step === '' || typeof step === 'undefined') {
                    step = 1;
                }

                // Max Value Validation
                if (+new_qty > +max && max !== '') {
                    new_qty = max;
                }
                // Min Value Validation
                else if (+new_qty < +min && min !== '') {
                        new_qty = min;
                    }

                // Calculate remainder
                step = step * multiplier();
                new_qty = new_qty * multiplier();
                min = min * multiplier();
                max = max * multiplier();

                var rem = (new_qty - min) % step;

                // Step Value Value Validation
                if (rem !== 0) {
                    new_qty = +new_qty + (+step - +rem);

                    // Max Value Validation
                    if (max > 0 && +new_qty > +max) {
                        new_qty = +new_qty - +step;
                    }
                }

                // Set the new value
                $input.val((new_qty / multiplier()).toFixed(self._getDecimals(stepOrig)));

                self._updateCartQuantity($(this).parents('.sc-cart-item').data('unique-key'), $input.val());
            });

            $(this.cartElement).on("change select", '.sc-cart-item-qty', function (e) {
                var $input = $(e.currentTarget);
                self._updateCartQuantity($(this).parents('.sc-cart-item').data('unique-key'), $input.val());
            });

            // Cart checkout event
            $(this.cartElement).on("click", '.sc-cart-checkout', function (e) {
                if ($(this).hasClass('disabled')) {
                    return false;
                }
                e.preventDefault();
                self._submitCart();
            });

            // Cart clear event
            $(this.cartElement).on("click", '.sc-cart-clear', function (e) {
                if ($(this).hasClass('disabled')) {
                    return false;
                }
                e.preventDefault();
                $('.sc-cart-item-list tbody > .sc-cart-item', this.cartElement).fadeOut(self.options.transitionsDuration, function () {
                    $(this).remove();
                    self._clearCart();
                    self._hasCartChange();
                });
            });
        },
        /* 
         * Get the parameters of a product by seaching elements with name attribute/data.
         * Product details will be return as an object
         */
        _getProductDetails: function (elm) {
            var self = this;
            var p = {};
            elm.parents(this.options.productContainerSelector).find(this.options.productElementSelector).each(function () {
                if ($(this).is('[name]') === true || typeof $(this).data('name') !== typeof undefined) {
                    var key = $(this).attr('name') ? $(this).attr('name') : $(this).data('name');
                    var val = self._getContent($(this));
                    if (key && val) {
                        p[key] = val;
                    }
                }
            });
            return p;
        },
        /* 
         * Add the product object to the cart
         */
        _addToCart: function (p) {
            var self = this;

            if (!p.hasOwnProperty(this.options.paramSettings.productPrice)) {
                this._logError('Price is not set for the item');
                return false;
            }

            if (!p.hasOwnProperty(this.options.paramSettings.productQuantity)) {
                this._logMessage('Quantity not found, default to 1');
                p[this.options.paramSettings.productQuantity] = 1;
            }

            if (!p.hasOwnProperty('unique_key')) {
                p.unique_key = this._getUniqueKey();
            }

            p[this.options.paramSettings.productQuantity] = this._filterQuantity(p);

            if (this.options.combineProducts) {
                var pf = $.grep(this.cart, function (n, i) {
                    return self._isObjectsEqual(n, p);
                });
                if (pf.length > 0) {
                    var idx = this.cart.indexOf(pf[0]);
                    this.cart[idx][this.options.paramSettings.productQuantity] = this.cart[idx][this.options.paramSettings.productQuantity] - 0 + (p[this.options.paramSettings.productQuantity] - 0);
                    this.cart[idx][this.options.paramSettings.productQuantity] = this._filterQuantity(this.cart[idx]);
                    p = this.cart[idx];
                    // Trigger "itemUpdated" event
                    this._triggerEvent("itemUpdated", [p, this.cart]);
                } else {
                    this.cart.push(p);
                    // Trigger "itemAdded" event
                    this._triggerEvent("itemAdded", [p, this.cart]);
                }
            } else {
                this.cart.push(p);
                // Trigger "itemAdded" event
                this._triggerEvent("itemAdded", [p, this.cart]);
            }

            this._addUpdateCartItem(p);
            return p;
        },
        /* 
         * Remove the product object from the cart
         */
        _removeFromCart: function (unique_key) {
            var self = this;
            $.each(this.cart, function (i, n) {
                if (n.unique_key === unique_key) {
                    var itemRemove = self.cart[i];
                    self.cart.splice(i, 1);
                    $('*[data-product-unique-key="' + unique_key + '"]').removeClass('sc-added-item');
                    self._hasCartChange();

                    // Trigger "itemRemoved" event
                    self._triggerEvent("itemRemoved", [itemRemove, self.cart]);
                    return false;
                }
            });
        },
        /* 
         * Clear all products from the cart
         */
        _clearCart: function () {
            this.cart = [];
            // Trigger "cartCleared" event
            this._triggerEvent("cartCleared");
            this._hasCartChange();
        },
        /* 
         * Update the quantity of an item in the cart
         */
        _updateCartQuantity: function (unique_key, qty) {
            var self = this;
            var qv = this._getValidateNumber(qty);
            $.each(this.cart, function (i, n) {
                if (n.unique_key === unique_key) {
                    if (qv) {
                        self.cart[i][self.options.paramSettings.productQuantity] = qty;
                        self.cart[i][self.options.paramSettings.productQuantity] = self._filterQuantity(self.cart[i]);
                    }
                    self._addUpdateCartItem(self.cart[i]);
                    // Trigger "quantityUpdate" event
                    self._triggerEvent("quantityUpdated", [self.cart[i], qty, self.cart]);
                    return false;
                }
            });
        },
        /* 
         * Update the UI of the cart list
         */
        _addUpdateCartItem: function (p) {
            var productAmount = (p[this.options.paramSettings.productQuantity] - 0) * (p[this.options.paramSettings.productPrice] - 0);

            var cartList = $('.sc-cart-item-list tbody', this.cartElement);
            var elmMain = cartList.find("[data-unique-key='" + p.unique_key + "']");

            if (!elmMain || elmMain.length === 0) {
                elmMain = $('<tr></tr>').addClass('sc-cart-item');
                elmMain.attr('data-unique-key', p.unique_key);

                var min = this._getQuantityMin(p);
                var max = this._getQuantityMax(p);
                var step = typeof p[this.options.paramSettings.productQuantityStep] !== "undefined" ? p[this.options.paramSettings.productQuantityStep] : this.options.quantityOptions.step;
                var templateUpdated = this.options.cartItemTemplate.replace('{' + this.options.paramSettings.productPrice + '}', this._getMoneyFormatted(p[this.options.paramSettings.productPrice]));

                var quantitySelect = $('<select class="sc-cart-item-qty"></select>');
                var value = this._getValueOrEmpty(p[this.options.paramSettings.productQuantity]);

                var selectMin = min > 0 ? min : 1;
                var selectMax = max < 100 ? max : 100;
                for (var i = selectMin; i <= selectMax; i++) {
                    var stepValue = step * i;
                    quantitySelect.append('<option value="' + stepValue + '">' + stepValue + '</option>');
                }

                templateUpdated = templateUpdated.replace('{' + this.options.paramSettings.productQuantity + '}', quantitySelect.prop('outerHTML'));

                templateUpdated = templateUpdated.replace('{' + this.options.paramSettings.productTotal + '}', this._getMoneyFormatted(productAmount));

                elmMain.append(this._formatTemplate(templateUpdated, p));
                elmMain.append('<td><button type="button" class="sc-cart-remove">' + this.options.lang.cartRemove + '</button></td>');

                cartList.append(elmMain);
            }

            elmMain.find(".sc-cart-item-qty").val(p[this.options.paramSettings.productQuantity]);
            elmMain.find(".sc-cart-item-amount").text(this._getMoneyFormatted(productAmount));

            // Apply the highlight effect
            if (this.options.highlightEffect === true) {
                elmMain.addClass('sc-highlight');
                setTimeout(function () {
                    elmMain.removeClass('sc-highlight');
                }, 500);
            }

            this._hasCartChange();
        },
        /* 
         * Handles the changes in the cart 
         */
        _hasCartChange: function () {
            $('.sc-cart-count', this.cartElement).text(this.cart.length);
            $('.sc-cart-subtotal', this.element).text(this._getCartSubtotal());

            if (this.cart.length === 0) {
                $('.sc-cart-item-list tbody', this.cartElement).empty().append($('<tr class="sc-cart-empty-msg"><td>' + this.options.lang.cartEmpty + '</td></tr>'));
                $(this.options.productContainerSelector).removeClass('sc-added-item');
                $('.sc-cart-checkout, .sc-cart-clear').addClass('disabled').attr('disabled', true);

                // Trigger "cartEmpty" event
                this._triggerEvent("cartEmpty");
            } else {
                $('.sc-cart-item-list tbody > .sc-cart-empty-msg', this.cartElement).remove();
                $('.sc-cart-checkout, .sc-cart-clear').removeClass('disabled').attr('disabled', false);
            }

            // Update cart value to the  cart hidden element 
            $('#' + this.options.resultName, this.cartElement).val(JSON.stringify(this.cart));

            if (this.options.storageSettings.persistentCart === true) {
                // Store cart value to persistent storage
                this._storageApi.setItem(this.options.storageSettings.storageKey, JSON.stringify(this.cart));
            }
        },
        /* 
         * Calculates the cart subtotal
         */
        _getCartSubtotal: function () {
            var self = this;
            var subtotal = 0;
            $.each(this.cart, function (i, p) {
                if (self._getValidateNumber(p[self.options.paramSettings.productPrice])) {
                    subtotal += (p[self.options.paramSettings.productPrice] - 0) * (p[self.options.paramSettings.productQuantity] - 0);
                }
            });
            return this._getMoneyFormatted(subtotal);
        },
        /*
         * Filter product quantity
         */
        _filterQuantity: function (p) {
            var quantity = p[this.options.paramSettings.productQuantity],
                min = this._getQuantityMin(p),
                max = this._getQuantityMax(p);
            if (quantity < min) {
                return min;
            }
            if (quantity > max) {
                return max;
            }
            return quantity;
        },
        /*
         * Min product quantity
         */
        _getQuantityMin: function (p) {
            return typeof p[this.options.paramSettings.productQuantityMin] !== "undefined" ? p[this.options.paramSettings.productQuantityMin] : this.options.quantityOptions.min;
        },
        /*
         * Max product quantity
         */
        _getQuantityMax: function (p) {
            return typeof p[this.options.paramSettings.productQuantityMax] !== "undefined" ? p[this.options.paramSettings.productQuantityMax] : this.options.quantityOptions.max;
        },
        /* 
         * Cart submit functionalities
         */
        _submitCart: function () {
            var self = this;
            var formElm = this.cartElement.parents('form');
            if (!formElm) {
                this._logError('Form not found to submit');
                return false;
            }

            switch (this.options.submitSettings.submitType) {
                case 'ajax':
                    var ajaxURL = this.options.submitSettings.ajaxURL && this.options.submitSettings.ajaxURL.length > 0 ? this.options.submitSettings.ajaxURL : formElm.attr('action');

                    var ajaxSettings = $.extend(true, {}, {
                        url: ajaxURL,
                        type: "POST",
                        data: formElm.serialize(),
                        beforeSend: function () {
                            self.cartElement.addClass('loading');
                        },
                        error: function (jqXHR, status, message) {
                            self.cartElement.removeClass('loading');
                            self._logError(message);
                        },
                        success: function (res) {
                            self.cartElement.removeClass('loading');
                            self._triggerEvent("cartSubmitted", [self.cart]);
                            self._clearCart();
                        }
                    }, this.options.submitSettings.ajaxSettings);

                    $.ajax(ajaxSettings);

                    break;
                case 'paypal':
                    formElm.children('.sc-paypal-input').remove();
                    // Add paypal specific fields for cart products
                    $.each(this.cart, function (i, p) {
                        var itemNumber = i + 1;
                        formElm.append('<input class="sc-paypal-input" name="item_number_' + itemNumber + '" value="' + self._getValueOrEmpty(p[self.options.paramSettings.productId]) + '" type="hidden">').append('<input class="sc-paypal-input" name="item_name_' + itemNumber + '" value="' + self._getValueOrEmpty(p[self.options.paramSettings.productName]) + '" type="hidden">').append('<input class="sc-paypal-input" name="amount_' + itemNumber + '" value="' + self._getValueOrEmpty(p[self.options.paramSettings.productPrice]) + '" type="hidden">').append('<input class="sc-paypal-input" name="quantity_' + itemNumber + '" value="' + self._getValueOrEmpty(p[self.options.paramSettings.productQuantity]) + '" type="hidden">');
                    });

                    formElm.submit();
                    this._triggerEvent("cartSubmitted", [this.cart]);

                    break;
                default:
                    formElm.submit();
                    this._triggerEvent("cartSubmitted", [this.cart]);

                    break;
            }

            return true;
        },

        // SERVICES
        /* 
         * Storage
         */
        _storageApi: undefined,
        _initStorageApi: function () {
            if (this.options.storageSettings.persistentCart === true) {
                this._storageApi = this.options.storageSettings.storageApi;

                // @see https://github.com/Modernizr/Modernizr/blob/219b377beecf3473f479a3151eff9de086c41f3e/feature-detects/storage/localstorage.js
                var mod = 'modernizr';
                try {
                    this._storageApi.setItem(mod, mod);
                    this._storageApi.getItem(mod);
                    this._storageApi.removeItem(mod);
                } catch (e) {
                    this._logMessage('Storage API is broken: persistent cart disabled.');
                    this._storageApi = undefined;
                    this.options.storageSettings.persistentCart = false;
                }
            }
        },

        // HELPER FUNCTIONS
        /*
         * Get the content of an HTML element irrespective of its type
         */
        _getContent: function (elm) {
            if (elm.is(":checkbox, :radio")) {
                return elm.is(":checked") ? elm.val() : '';
            } else if (elm.is("[value], select")) {
                return elm.val();
            } else if (elm.is("img")) {
                return elm.attr('src');
            } else {
                return elm.text();
            }
            return '';
        },
        /* 
         * Compare equality of two product objects
         */
        _isObjectsEqual: function (o1, o2) {
            if (Object.getOwnPropertyNames(o1).length !== Object.getOwnPropertyNames(o2).length) {
                return false;
            }
            for (var p in o1) {
                if (p === 'unique_key' || p === this.options.paramSettings.productQuantity) {
                    continue;
                }
                if (typeof o1[p] === typeof undefined && typeof o2[p] === typeof undefined) {
                    continue;
                }
                if (o1[p] !== o2[p]) {
                    return false;
                }
            }
            return true;
        },
        /* 
         * Format money
         */
        _getMoneyFormatted: function (n) {
            n = n - 0;
            return Number(n.toFixed(2)).toLocaleString(this.options.currencySettings.locales, this.options.currencySettings.currencyOptions);
        },
        /* 
         * Get the value of an element and empty value if the element not exists 
         */
        _getValueOrEmpty: function (v) {
            return v && typeof v !== typeof undefined ? v : '';
        },
        /* 
         * Validate Number
         */
        _getValidateNumber: function (n) {
            n = n - 0;
            if (n && n > 0) {
                return true;
            }
            return false;
        },
        _getDecimals: function (num) {
            var match = ('' + num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
            if (!match) {
                return 0;
            }
            return Math.max(0, (match[1] ? match[1].length : 0) - (match[2] ? +match[2] : 0));
        },
        /* 
         * Small templating function
         */
        _formatTemplate: function (t, o) {
            var r = t.split("{"),
                fs = '';
            for (var i = 0; i < r.length; i++) {
                var vr = r[i].substring(0, r[i].indexOf("}"));
                if (vr.length > 0) {
                    fs += r[i].replace(vr + '}', this._getValueOrEmpty(o[vr]));
                } else {
                    fs += r[i];
                }
            }
            return fs;
        },
        /* 
         * Event raiser
         */
        _triggerEvent: function (name, params) {
            // Trigger an event
            var e = $.Event(name);
            this.cartElement.trigger(e, params);
            if (e.isDefaultPrevented()) {
                return false;
            }
            return e.result;
        },
        /* 
         * Get unique key
         */
        _getUniqueKey: function () {
            var d = new Date();
            return d.getTime();
        },
        /* 
         * Log message to console
         */
        _logMessage: function (msg) {
            if (this.options.debug !== true) {
                return false;
            }
            // Log message
            console.log(msg);
        },
        /* 
         * Log error to console and terminate execution
         */
        _logError: function (msg) {
            if (this.options.debug !== true) {
                return false;
            }
            // Log error
            $.error(msg);
        },

        // PUBLIC FUNCTIONS
        /* 
         * Public function to sumbit the cart
         */
        submit: function () {
            this._submitCart();
        },
        /* 
         * Public function to clear the cart
         */
        clear: function () {
            this._clearCart();
        }
    });

    // Wrapper for the plugin
    $.fn.smartCart = function (options) {
        var args = arguments;
        var instance;

        if (options === undefined || typeof options === 'object') {
            return this.each(function () {
                if (!$.data(this, "smartCart")) {
                    $.data(this, "smartCart", new SmartCart(this, options));
                }
            });
        } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {
            instance = $.data(this[0], 'smartCart');

            if (options === 'destroy') {
                $.data(this, 'smartCart', null);
            }

            if (instance instanceof SmartCart && typeof instance[options] === 'function') {
                return instance[options].apply(instance, Array.prototype.slice.call(args, 1));
            } else {
                return this;
            }
        }
    };
})(jQuery, window, document);