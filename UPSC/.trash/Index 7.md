---

database-plugin: basic

---

%% dbfolder:yaml
name: new database
description: new description
columns:
  column1:
    input: text
    key: column1
    accessorKey: column1
    label: Column 1
    position: 0
    skipPersist: false
    isHidden: false
    sortIndex: -1
    config:
      enable_media_view: true
      media_width: 100
      media_height: 100
      isInline: false
      task_hide_completed: true
  __file__:
    key: __file__
    input: markdown
    label: File
    accessorKey: __file__
    isMetadata: true
    skipPersist: false
    isDragDisabled: false
    csvCandidate: true
    isHidden: false
    sortIndex: -1
    config:
      enable_media_view: true
      link_alias_enabled: true
      media_width: 100
      media_height: 100
      isInline: true
      task_hide_completed: true
config:
  remove_field_when_delete_column: false
  cell_size: normal
  sticky_first_column: false
  group_folder_column: 
  show_metadata_created: false
  show_metadata_modified: false
  show_metadata_tasks: false
  show_metadata_inlinks: false
  show_metadata_outlinks: false
  source_data: current_folder
  source_form_result: root
  source_destination_path: /
  frontmatter_quote_wrap: false
  row_templates_folder: /
  current_row_template: 
  pagination_size: 10
  formula_folder_path: /
  inline_default: false
  inline_new_position: top
  date_format: yyyy-MM-dd
  datetime_format: "yyyy-MM-dd HH:mm:ss"
  remove_empty_folders: false
  automatically_group_files: false
  hoist_files_with_empty_attributes: true
  enable_js_formulas: false
filters:
  enabled: true
  conditions:
%%