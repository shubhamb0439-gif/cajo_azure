/*
  # Comprehensive Help System Update

  ## Overview
  Updates all help articles to reflect current system features including:
  - Handheld QR Scanner functionality  
  - Sales Overview/CRM Dashboard
  - Assembly Files management
  - Currency switching
  - Enhanced Foreign Exchange Rate management
  - Updated workflows and features

  ## Changes
  1. Add new articles for missing features
  2. Update existing articles with more detail
  3. Add new FAQs for common questions
  4. Enhance how-to guides with step-by-step instructions

  ## Categories Updated
  - Getting Started (currency switching, dashboard features)
  - Manufacturing & Assembly (assembly files)
  - CRM (Sales Overview dashboard)
  - Support & Ticketing (Handheld functionality)
*/

-- First, let's update the Foreign Exchange Rate article with actual steps
UPDATE help_articles 
SET content = 'The Foreign Exchange (FX) Rate system helps manage multi-currency transactions.

Key Features:
• Set and update exchange rates for INR per unit of foreign currency
• View exchange rates in real-time across the system
• Switch between currencies in the interface
• All purchases and sales can display in multiple currencies

Managing Exchange Rates:

Who Can Update Rates:
• Admin users can update exchange rates
• Users with "read_write" access can update exchange rates
• Read-only users can only view exchange rates

How to Update Exchange Rates:
1. Navigate to Settings > Data Setup tab
2. Scroll to the "Foreign Exchange Rates" section
3. Enter the new rate (e.g., INR per 1 EUR)
4. Click "Save Exchange Rate"
5. The new rate is immediately active system-wide

Currency Display:
• Click the currency symbol (₹/€) in the top bar to switch display currency
• All monetary values will convert using the current exchange rate
• Your preference persists across sessions

Best Practices:
• Update rates regularly to reflect current market conditions
• Check rates before processing large transactions
• Document rate changes in activity logs (automatic)
• Verify rate accuracy after updates',
updated_at = now()
WHERE title = 'What is Foreign Exchange Rate Management?'
AND type = 'knowledgebase';

-- Add Handheld QR Scanner articles to Support & Ticketing
INSERT INTO help_articles (category_id, title, content, type, tags, "order") VALUES
(
  '541a516a-b88b-4e28-a8c4-1c6e0e1087ad',
  'Handheld QR Scanner Overview',
  'The Handheld QR Scanner provides mobile-optimized device status updates in the field.

Key Features:
• Scan device QR codes using mobile camera
• Manually search devices by serial number
• Quick status updates (Ordered, Delivered, Installed, Online, Offline)
• View device history and location
• Optimized for mobile use in the field

When to Use:
• Field technicians updating device status
• Delivery personnel confirming installations
• Warehouse staff tracking device movements
• Quick status checks without full Support interface

Access:
• Available at /handheld route
• Best experienced on mobile devices
• Works on desktop with manual serial entry
• QR scanning requires camera permissions

Status Options:
• Ordered (blue): Device has been ordered
• Delivered (purple): Device delivered to customer
• Installed (yellow): Device installed at location
• Online (green): Device is connected and operational
• Offline (red): Device is not connected

Location Tracking:
• Optional location field for each status update
• Track device movement through supply chain
• Useful for logistics and support teams',
  'knowledgebase',
  ARRAY['handheld', 'qr scanner', 'mobile', 'devices', 'field service'],
  7
),
(
  '541a516a-b88b-4e28-a8c4-1c6e0e1087ad',
  'How to Use the Handheld Scanner',
  'Step-by-step guide for using the Handheld QR scanner in the field.

Finding a Device:

Method 1: QR Code Scanning (Mobile Only)
1. Open the Handheld page on your mobile device
2. Tap "Scan QR Code" button
3. Allow camera permissions if prompted
4. Point camera at device QR code
5. Device details load automatically when detected

Method 2: Manual Serial Entry
1. Open the Handheld page
2. Enter device serial number in search box
3. Click "Search" or press Enter
4. Device details load if serial number is valid

Updating Device Status:

1. After loading device, review current status and details
2. Select new status from the grid of options:
   • Ordered: Initial order placed
   • Delivered: Arrived at destination
   • Installed: Set up and configured
   • Online: Connected and working
   • Offline: Not connected
3. (Optional) Enter location information
4. Click "Update Status"
5. Confirmation appears and history updates
6. Screen clears automatically after 2 seconds

Viewing Device History:

• Recent history shows below the update form
• See all previous status changes
• View who made each change and when
• Check location history for the device

Tips:
• Ensure good lighting when scanning QR codes
• Clean QR codes scan more reliably
• Location updates help track device movements
• History is permanent and cannot be edited',
  'howto',
  ARRAY['handheld', 'qr scanner', 'tutorial', 'devices', 'status'],
  8
),
(
  '541a516a-b88b-4e28-a8c4-1c6e0e1087ad',
  'QR Scanner FAQs',
  'Q: Why can''t I see the "Scan QR Code" button?
A: QR scanning is only available on mobile devices with cameras. Use manual serial entry on desktop computers or devices without cameras.

Q: The QR scanner won''t open or asks for permissions?
A: The scanner needs camera access. Allow camera permissions in your browser settings. On iOS, go to Settings > Browser > Camera. On Android, go to App Settings > Permissions > Camera.

Q: QR code won''t scan?
A: Ensure good lighting, clean the QR code, hold steady, and make sure the entire code is visible in the frame. If issues persist, use manual serial number entry.

Q: Can I change a device status back?
A: Yes, status updates can be changed. Select the device again and choose any status. All changes are logged in device history.

Q: What if I enter the wrong location?
A: Update the device status again with the correct location. The latest location update will be used and all history is preserved.

Q: Do I need special permissions to use Handheld?
A: Any authenticated user can use the Handheld scanner. However, you need appropriate device permissions based on RLS policies (typically users can update devices in their system).

Q: Why does the screen clear after updating?
A: After successful update, the screen auto-clears after 2 seconds to make it easy to scan the next device. You can always search for the device again to see full details.',
  'faq',
  ARRAY['handheld', 'qr scanner', 'troubleshooting', 'mobile'],
  9
);

-- Add Sales Overview / CRM Dashboard articles
INSERT INTO help_articles (category_id, title, content, type, tags, "order") VALUES
(
  'b5b90989-6d85-49e1-8e20-88cb9e60c287',
  'Sales Overview Dashboard',
  'The Sales Overview provides a visual kanban board for managing your entire sales pipeline.

Key Features:
• Drag-and-drop interface for moving leads through pipeline
• Visual kanban boards for Leads, Prospects, and Customers
• Real-time updates across all users
• Value tracking and pipeline metrics
• Automatic conversion between stages

Dashboard Views:

1. Leads Board:
   • New: Fresh inquiries
   • Contacted: Initial outreach completed
   • Qualified: Meets criteria, ready for conversion
   • Lost: Not pursuing

2. Prospects Board:
   • Qualified: Converted from leads
   • Demo Scheduled: Presentation planned
   • Demo Completed: Demo finished
   • Proposal Sent: Formal proposal delivered
   • Negotiation: Terms being discussed
   • Won: Convert to customer
   • Lost: Deal not closed

3. Customers Board:
   • Active: Current customers
   • Inactive: Not currently purchasing
   • At Risk: May churn
   • Churned: No longer a customer

Summary Cards:
• Total count for each stage
• Total potential/lifetime value
• Quick metrics at a glance

Using Drag-and-Drop:
• Drag any card to a new status column
• Dragging Lead to "Qualified" converts to Prospect
• Dragging Prospect to "Won" converts to Customer
• All conversions preserve data and history

Access: Navigate to Sales Overview from the main menu or Dashboard.',
  'knowledgebase',
  ARRAY['sales overview', 'crm dashboard', 'kanban', 'pipeline', 'visual'],
  5
),
(
  'b5b90989-6d85-49e1-8e20-88cb9e60c287',
  'How to Use Sales Overview',
  'Step-by-step guide to managing your sales pipeline visually.

Accessing the Dashboard:
1. Navigate to Sales Overview from main menu
2. Choose a tab: Leads, Prospects, or Customers
3. View kanban board with status columns

Moving Leads Through Pipeline:

1. Click and hold on any lead card
2. Drag to the appropriate status column
3. Release to drop
4. Lead status updates automatically
5. All users see changes in real-time

Converting Leads to Prospects:
1. Drag a Lead card to the "Qualified" column
2. Lead automatically converts to Prospect
3. Original lead is removed
4. New prospect appears in Prospects tab
5. All data is preserved

Converting Prospects to Customers:
1. Switch to Prospects tab
2. Drag a Prospect to the "Won" column
3. Prospect converts to Customer
4. Customer appears in Customers tab with "Active" status
5. Original prospect data preserved

Reading the Cards:
• Name and company displayed prominently
• Value shown with currency symbol
• Source and assigned user badges
• Color-coded status indicators

Filtering and Organizing:
• Switch between tabs to focus on each stage
• Scroll horizontally to see all status columns
• Cards show most recent items first within each column

Tips:
• Regular pipeline reviews keep deals moving
• Use consistent status updates for reporting
• Assign leads to team members for accountability
• Track values for accurate forecasting',
  'howto',
  ARRAY['sales overview', 'pipeline', 'kanban', 'tutorial', 'drag drop'],
  6
);

-- Add Assembly Files articles to Manufacturing
INSERT INTO help_articles (category_id, title, content, type, tags, "order") VALUES
(
  '1dab1bed-c80a-4a80-9f53-54d33499031d',
  'Assembly Files and Documentation',
  'The Assembly Files system allows you to attach documents, images, and files to specific assembly units.

Key Features:
• Upload multiple files per assembly unit
• Support for all file types (documents, images, PDFs, CAD files, etc.)
• Download files anytime
• Track who uploaded each file and when
• Secure storage in Supabase Storage
• Delete files (owner or admin only)

Use Cases:
• Quality inspection reports
• Assembly photos for documentation
• Test certificates and compliance documents
• Customer-specific specifications
• Work instructions or procedures
• CAD drawings or technical diagrams

File Information Tracked:
• File name and type
• File size
• Upload date and time
• User who uploaded (email shown)
• Direct download access

Storage:
• Files stored securely in cloud storage
• Organized by user and assembly unit
• Accessible only through the application
• Automatic activity logging for all operations

Permissions:
• Any user can upload files to assemblies
• Anyone can download files
• Only file uploader or admin can delete files
• All file operations logged in activity log

Access:
• Open Manufacturing page
• Go to Assembly or Traceability tab
• Click "Files" button on any assembly unit
• Side panel opens with file management interface',
  'knowledgebase',
  ARRAY['manufacturing', 'assembly', 'files', 'documentation', 'uploads'],
  6
),
(
  '1dab1bed-c80a-4a80-9f53-54d33499031d',
  'How to Manage Assembly Files',
  'Step-by-step guide to uploading and managing files for assemblies.

Uploading Files:

1. Navigate to Manufacturing page
2. Click "Assembly" or "Traceability" tab
3. Find the assembly unit you want to document
4. Click the "Files" button
5. Click "Upload Files" button
6. Select one or more files from your computer
7. Files upload automatically
8. Success confirmation appears
9. Files appear in the list immediately

Downloading Files:

1. Open the Files panel for an assembly
2. Find the file you want to download
3. Click the download icon (down arrow)
4. File downloads to your default download folder
5. Download is logged in activity log

Deleting Files:

1. Open the Files panel
2. Find the file to delete
3. Click the trash icon (only visible if you own the file or are admin)
4. Confirm deletion when prompted
5. File is removed from storage immediately
6. Deletion is logged in activity log

Viewing File Information:
• File name shows at the top
• File size displays below name
• Upload date and time shown
• Uploader email address visible
• Icon shows file type (document, image, archive, etc.)

Best Practices:
• Use descriptive file names
• Upload quality reports immediately after testing
• Take photos during assembly for future reference
• Store all certifications and compliance docs
• Don''t delete files unless absolutely necessary
• Regular documentation improves traceability

Supported File Types:
• Documents: PDF, DOC, DOCX, TXT, XLS, XLSX
• Images: JPG, PNG, GIF, BMP, TIFF
• CAD: DWG, DXF, STEP, STL
• Archives: ZIP, RAR, 7Z
• Any other file type supported',
  'howto',
  ARRAY['manufacturing', 'assembly', 'files', 'upload', 'documentation', 'tutorial'],
  7
),
(
  '1dab1bed-c80a-4a80-9f53-54d33499031d',
  'Assembly Files FAQs',
  'Q: How many files can I upload per assembly?
A: There is no hard limit. You can upload as many files as needed for documentation.

Q: What file size limit exists?
A: Check with your administrator for storage limits. Generally, reasonable file sizes (under 50MB per file) are recommended.

Q: Can other users see files I upload?
A: Yes, all authenticated users can see and download all files. This ensures team collaboration and information sharing.

Q: Why can''t I delete a file?
A: Only the person who uploaded the file or system administrators can delete files. This prevents accidental deletion of important documentation.

Q: Are file uploads logged?
A: Yes, all file operations (upload, download, delete) are logged in the activity log with timestamp and user information.

Q: Can I upload files in bulk?
A: Yes, the file upload dialog supports multiple file selection. Select all files you want to upload at once.

Q: What happens to files if an assembly is deleted?
A: Files are associated with assembly units. If the unit is deleted (through reversal), files remain in storage but become inaccessible. Consult admin before deleting assemblies.

Q: Can customers see assembly files?
A: No, files are only accessible through the internal Manufacturing interface, not through the customer portal.',
  'faq',
  ARRAY['manufacturing', 'assembly', 'files', 'troubleshooting'],
  8
);

-- Add Currency Switching article to Getting Started
INSERT INTO help_articles (category_id, title, content, type, tags, "order") VALUES
(
  '43813c59-9438-47d0-9c0d-d2c0980bf880',
  'How to Switch Currency Display',
  'The system supports multi-currency display for all monetary values.

Currency Features:
• View all amounts in INR (Indian Rupees) or EUR (Euros)
• Click currency symbol in top bar to switch
• Conversion uses current exchange rate from Settings
• Preference saved for your session
• Affects all pages system-wide

How to Switch Currency:

1. Look at the top navigation bar
2. Find the currency symbol (₹ or €)
3. Click the symbol
4. Currency toggles instantly
5. All monetary values convert
6. Page does not reload

What Gets Converted:
• Purchase amounts and item costs
• Sale prices and totals
• Purchase Order values
• Inventory values
• Lead/Prospect/Customer values
• Dashboard metrics and summaries

Exchange Rate:
• Set by administrators in Settings > Data Setup
• Applied consistently across entire system
• Updates immediately when changed
• Visible in status bar when hovering over currency

Why Use Multiple Currencies:
• International suppliers and customers
• Local reporting requirements
• Compare costs in different markets
• Budget planning in preferred currency

Tips:
• Check exchange rate before important decisions
• Switch currency to match your current task
• Use EUR for international supplier quotes
• Use INR for local accounting and reports
• Your currency preference persists during your session

Note: Base transaction currency does not change. Currency switching is for display and reporting only.',
  'howto',
  ARRAY['currency', 'forex', 'multi-currency', 'display', 'tutorial'],
  6
);

-- Update the "Understanding the Dashboard" article with more current features
UPDATE help_articles
SET content = 'The Dashboard provides a comprehensive overview of your business operations.

Top Metrics:
• Total Users: Active system users
• Total Items: Inventory items in system
• Active Leads: Current sales opportunities
• Customer Tickets: Open support requests

Inventory Alerts:
• Low Stock Warnings: Red indicators show items below minimum stock
• Action Required: Click to view and manage critical inventory
• Color-coded severity levels
• Quick navigation to inventory details

Recent Purchase Orders:
• Latest customer orders
• Status tracking (Pending, Processing, Completed, Late)
• Quick access to order details
• See PO numbers, customers, and dates

Recent Activity Feed:
• Real-time activity across the system
• User actions with timestamps
• Filterable and searchable
• Provides audit trail

Navigation:
• Cards link to detailed pages
• Quick stats provide instant insights
• Real-time data updates
• Mobile-responsive layout

Sales Overview Link:
• Visual CRM pipeline
• Drag-and-drop kanban boards
• Access from dashboard card or main menu

Currency Display:
• Toggle between INR (₹) and EUR (€)
• Click currency symbol in top bar
• Affects all monetary displays system-wide

Best Practices:
• Check dashboard daily for urgent alerts
• Review activity log for team awareness
• Monitor low stock items proactively
• Track PO status to meet delivery commitments',
updated_at = now()
WHERE title = 'Understanding the Dashboard'
AND type = 'knowledgebase';

-- Add FAQ about currency display
INSERT INTO help_articles (category_id, title, content, type, tags, "order") VALUES
(
  '43813c59-9438-47d0-9c0d-d2c0980bf880',
  'Currency and Exchange Rate FAQs',
  'Q: Which currencies does the system support?
A: The system displays amounts in INR (Indian Rupees ₹) and EUR (Euros €). Toggle between them using the currency symbol in the top bar.

Q: Who can change the exchange rate?
A: Admin users and users with "read_write" access can update exchange rates. Read-only users can only view rates.

Q: How often should exchange rates be updated?
A: Update rates as frequently as needed for accuracy. For businesses with significant international transactions, daily or weekly updates are recommended.

Q: Does switching currency change my data?
A: No, currency switching only changes the display. All data is stored in the original transaction currency. The display converts using the current exchange rate.

Q: Why can''t I save the exchange rate?
A: Check your user permissions. You need "read_write" access or admin role to update rates. Also ensure your account is enabled. If issues persist, check browser console for errors.

Q: Will changing the exchange rate affect existing transactions?
A: No, transactions are recorded at their original amounts. The exchange rate only affects current display conversions and new calculations.

Q: Can I add more currencies?
A: Currently the system supports INR and EUR. Additional currencies require development. Contact your system administrator for custom requirements.

Q: Where is the exchange rate set?
A: Navigate to Settings > Data Setup tab > Foreign Exchange Rates section. Enter the rate (INR per 1 EUR) and click Save.',
  'faq',
  ARRAY['currency', 'forex', 'exchange rate', 'multi-currency', 'permissions'],
  11
);

-- Update "Best Practices for System Use" to include new features
UPDATE help_articles
SET content = 'Follow these best practices for optimal system performance and data accuracy.

Data Entry:
• Use consistent naming conventions
• Enter complete information when creating records
• Double-check quantities and values
• Use serial numbers when available
• Document special requirements in notes

Inventory Management:
• Monitor stock alerts daily
• Maintain minimum stock levels
• Use BOMs for complex products
• Track serial numbers for high-value items
• Upload assembly files for documentation
• Regular stock audits

Purchase Management:
• Create purchase orders when ordering from vendors
• Mark items as received when they arrive
• Verify quantities before marking received
• Update exchange rates regularly for international purchases
• Track vendor performance with ratings

Sales & CRM:
• Use Sales Overview dashboard for pipeline visibility
• Move leads through stages consistently
• Convert qualified leads to prospects promptly
• Document all customer interactions
• Set realistic values for forecasting
• Assign leads to appropriate team members

Manufacturing:
• Create BOMs before assembling
• Ensure adequate component stock before assembly
• Upload photos and documents to assembly files
• Review traceability for quality issues
• Use descriptive assembly names

Support:
• Create devices before customers need them
• Use Handheld scanner for field updates
• Respond to customer tickets promptly
• Keep device status current
• Document solutions in ticket notes

System Usage:
• Log out when finished
• Use appropriate permissions (don''t share admin accounts)
• Switch currency display as needed for your task
• Check activity logs for team coordination
• Use search functions instead of scrolling
• Regular data exports for backup

Mobile Usage:
• Use Handheld page for field work
• QR scanning requires good lighting
• Ensure camera permissions enabled
• Mobile interface optimized for touch

Security:
• Never share login credentials
• Use strong passwords
• Report suspicious activity
• Verify user permissions regularly
• Lock your screen when away

Performance:
• Archive old data periodically
• Don''t keep unnecessary tabs open
• Clear browser cache if experiencing issues
• Use modern browsers for best experience',
updated_at = now()
WHERE title = 'Best Practices for System Use'
AND type = 'knowledgebase';
