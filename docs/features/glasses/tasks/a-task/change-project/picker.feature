@glasses @tasks
Feature: Choosing a project for a task

  "Change project" opens a filter menu, then a status list, then a project row — or a row that
  clears the project without drilling in.

  Background:
    Given I have opened a task's contextual menu

  Scenario: The filter menu
    When I choose "Change project"
    Then the glasses show the header "MOVE TO"
    And the header shows no count
    And the rows are:
      | — No project — |
      | All            |
      | Doing          |
      | Ongoing        |
      | Planned        |
      | On Hold        |
      | Done           |
      | Archived       |

  Scenario: A status list while projects load
    Given I have never opened a status list from this picker on these glasses
    When I choose "Change project"
    And I tap "Doing"
    Then the glasses show "Fetching…"

  Scenario: A status list with nothing in it
    Given no projects have that status
    When I choose "Change project"
    And I tap "Doing"
    Then the glasses show "No projects in progress."

  Scenario: Browsing a status list
    Given "Doing" holds the projects "Kitchen", "Website" and "Allotment"
    When I choose "Change project"
    And I tap "Doing"
    Then the glasses show the header "DOING (3)"
    And the projects are listed alphabetically
    # Alphabetical only while the picker is open — so a project is always in the same place.

  Scenario: Picking a project asks me to confirm
    When I choose "Change project"
    And I tap a status
    And I tap one of the projects
    Then the glasses show the header "MOVE TO?"

  Scenario: Clearing the project asks immediately
    When I choose "Change project"
    And I tap "— No project —"
    Then the glasses show the header "MOVE TO?"

  Scenario: Backing out from the filter menu returns to details
    Given I opened the picker from a task's contextual menu
    When I double-tap
    Then the glasses show "TASK DETAILS"

  Scenario: Backing out from a status list returns to the filter menu
    Given I chose "Change project" and tapped a status
    When I double-tap
    Then the glasses show the header "MOVE TO"
