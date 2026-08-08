@phone @settings
Feature: Choosing the four databases

  The app needs to know which Notion database is which. They are dropdowns rather than pasted ids,
  so the only thing to get right in Notion is sharing the right four databases with the
  integration.

  Background:
    Given the settings form is open
    And a working token has loaded its databases

  Scenario: The four choices, in order
    Then the phone shows four dropdowns labelled, in order:
      | Tasks Database    |
      | Notes Database    |
      | Projects Database |
      | Tags Database     |
    And each shows "Select a database..." until something is chosen

  Scenario: Lookalike databases can be told apart
    Given two of the shared databases are both called "Tasks"
    Then each option shows the database's name followed by the last part of its id
    And the two can be told apart

  Scenario: The form explains how to check against Notion
    Then the phone shows: "Not sure which to pick? In Notion, open the database inside Databases & Components, copy its link, and compare the part between the last / and ?v= with the id in the dropdown — they should match."

  Scenario: A database chosen once cannot be chosen again
    Given the databases are "Tasks", "Notes", "Projects" and "Tags"
    When I choose "Tasks" for the Tasks slot
    Then "Tasks" is no longer offered in the other three
    And it is still shown as the Tasks slot's own choice

  Scenario: Changing a choice puts the old one back
    Given "Tasks" is chosen for the Tasks slot
    When I change that slot to "Notes"
    Then "Tasks" is offered again in the other three
    And "Notes" is no longer offered in them

  Scenario: Saving a complete choice
    Given all four are set
    When I tap "Save"
    Then the setup is saved
    And the settings form closes

  Scenario: Saving with one unset
    Given the Tags slot is unset
    When I tap "Save"
    Then the form stays open
    And that dropdown is marked as needing attention
    And nothing is saved

  Scenario: An incomplete form says nothing beyond the marked fields
    Given the token is empty and nothing is chosen
    When I tap "Save"
    Then the token field and all four dropdowns are marked as needing attention
    And no message explains what is wrong
    And "Save" is never greyed out

  Rule: A database that has gone from Notion is not silently kept

    Scenario: A previously chosen database is no longer shared
      Given the app was set up earlier
      And the Projects database is no longer shared with the integration
      When I reopen settings and the databases load
      Then that slot is emptied
      And it shows "The previously selected database is no longer available — pick another."

    Scenario: The other three keep their choices
      Given only the Projects database has gone
      When the databases load
      Then Tasks, Notes and Tags keep what they had
      And only Projects asks to be picked again

    Scenario: Picking again clears the message
      Given the Projects slot is asking to be picked again
      When I choose a database for it
      Then the message disappears
      And "Save" now works

  @known-gap
  Scenario: A wrong token can be saved alongside the old databases
    Given the app was set up earlier
    When I reopen settings and replace the token with a wrong one of the right shape
    And the databases fail to load, so the dropdowns disappear
    And I tap "Save"
    Then the wrong token is saved with the databases I had chosen before
    And nothing on the form objected
    # The previous choices are still complete, so there is nothing for the form to stop on —
    # it only shows up later as everything failing to load.

  @known-gap
  Scenario: Saving is possible before the token has been checked
    Given the app was set up earlier
    When I edit the token and tap "Save" before it has been looked up
    Then it is saved without ever having been checked
