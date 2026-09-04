@glasses @tasks
Feature: Choosing a project for a task

  "Change project" opens a list of every project that is not archived, plus a row for taking the
  task out of whatever project it is in.

  Background:
    Given I have opened a task's contextual menu

  Scenario: The picker
    Given the workspace has the projects "Kitchen", "Website" and "Allotment"
    When I choose "Change project"
    Then the glasses show the header "MOVE TO"
    And the header shows no count
    And the first choice is "— No project —"
    And the rest are "Allotment", "Kitchen" and "Website", in that order
    # Alphabetical, so a project is always in the same place regardless of how Notion orders it.

  Scenario: While it loads
    Given I have never opened the picker on these glasses
    When I choose "Change project"
    Then the glasses show "Fetching projects..."

  Scenario: When there is nothing to pick
    Given the workspace has no projects
    When I choose "Change project"
    Then the glasses show "No projects found."

  Scenario: Picking a project asks me to confirm
    When I choose "Change project"
    And I tap one of the projects
    Then the glasses show the header "MOVE TO?"

  Scenario: Backing out returns to the list the task came from
    Given I opened the picker from a task's contextual menu
    When I double-tap
    Then the list the task came from reopens
