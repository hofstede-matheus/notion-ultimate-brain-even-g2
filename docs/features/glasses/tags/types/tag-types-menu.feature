@glasses @tags
Feature: The tag types

  The Ultimate Brain template sorts tags into three kinds. This submenu is the way to see one kind
  at a time rather than all tags at once.

  Background:
    Given I am on the "TAGS" menu

  Scenario: Opening the submenu
    When I tap "Types"
    Then the glasses show the header "TAG TYPES"
    And the choices are "Area", "Resource" and "Entity"
    And there is nothing to wait for

  Scenario Outline: Each kind opens its list
    Given I am on the "TAG TYPES" menu
    When I tap "<choice>"
    Then the glasses show the header "<title>"

    Examples:
      | choice   | title         |
      | Area     | AREA TAGS     |
      | Resource | RESOURCE TAGS |
      | Entity   | ENTITY TAGS   |

  Scenario: Going back to the Tags menu
    Given I am on the "TAG TYPES" menu
    When I double-tap
    Then the glasses show the header "TAGS"
