@glasses @notes
Feature: Choosing a project for a note

  "Change project" opens a list of every project that is not archived, plus a row for taking the
  note out of whatever project it is in. It is the same picker a task uses.

  Background:
    Given I have opened a note's action menu

  Scenario: The picker
    Given the workspace has the projects "Kitchen", "Website" and "Allotment"
    When I tap "Change project"
    Then the glasses show the header "MOVE TO"
    And the header shows no count
    And the first choice is "— No project —"
    And the rest are "Allotment", "Kitchen" and "Website", in that order

  Scenario: While it loads
    Given I have never opened the picker on these glasses
    When I tap "Change project"
    Then the glasses show "Fetching projects..."

  Scenario: When there is nothing to pick
    Given the workspace has no projects
    When I tap "Change project"
    Then the glasses show "No projects found."

  Scenario: Picking a project asks me to confirm
    When I tap "Change project"
    And I tap one of the projects
    Then the glasses show the header "MOVE TO?"

  Scenario: Backing out returns to the note's action menu
    Given I opened the picker from a note's action menu
    When I double-tap
    Then that note's action menu reopens
