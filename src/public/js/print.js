/**
 * HRM System — Print Utility
 * ----------------------------------------------------------------------------
 * Simple, reliable print functionality that triggers the browser's native
 * print dialog (same as Ctrl+P). The @media print CSS in tailwind.css
 * handles hiding app chrome and formatting the output for print.
 *
 * Usage:
 *   HRM_Print.printPage()                     — Print current page
 *   HRM_Print.printPage('Custom Title')       — Print with custom title
 *   HRM_Print.printElement('#my-section')     — Print specific element
 *   HRM_Print.printElement('#payslip', 'Title') — Print element with title
 */
(function () {
  'use strict';

  var HRM_Print = {
    /**
     * Print the current page using the browser's native print dialog.
     * This is the same as pressing Ctrl+P.
     * The @media print CSS handles hiding app chrome and formatting.
     */
    printPage: function (customTitle) {
      // Optionally set the document title (used as the print job name)
      var originalTitle = document.title;
      if (customTitle) {
        document.title = customTitle;
      }

      // Add a print-active class to body so CSS can target print state
      document.body.classList.add('printing');

      // Trigger the browser's native print dialog
      window.print();

      // Restore the original title and remove the print class
      setTimeout(function () {
        document.title = originalTitle;
        document.body.classList.remove('printing');
      }, 500);
    },

    /**
     * Print a specific element by temporarily hiding everything else.
     * Falls back to printing the whole page if the element isn't found.
     */
    printElement: function (selectorOrEl, customTitle) {
      var el = typeof selectorOrEl === 'string'
        ? document.querySelector(selectorOrEl)
        : selectorOrEl;

      if (!el) {
        // Element not found — just print the whole page
        this.printPage(customTitle);
        return;
      }

      var originalTitle = document.title;
      if (customTitle) {
        document.title = customTitle;
      }

      // Mark the element for printing and hide everything else
      el.classList.add('hrm-print-target');
      document.body.classList.add('hrm-printing-element');

      window.print();

      // Restore
      setTimeout(function () {
        el.classList.remove('hrm-print-target');
        document.body.classList.remove('hrm-printing-element');
        document.title = originalTitle;
      }, 500);
    }
  };

  // Expose globally
  window.HRM_Print = HRM_Print;
})();
