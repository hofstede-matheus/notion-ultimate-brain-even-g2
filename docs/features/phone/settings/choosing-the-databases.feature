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

  Scenario: Two databases that both genuinely fit a role are told apart by id
    Given two of the shared databases are both called "Tasks" and both have the schema a Tasks
      database needs
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

  Rule: Databases are matched by schema, not just name

    Notion workspaces commonly hold more than one database with the same title — a stock
    "Projects" or "Tasks" template alongside a real one — and a name alone can't tell them
    apart. Each dropdown is narrowed to databases whose properties actually cover what that
    role needs (e.g. a Projects database needs Meta and Latest Activity, among others, since
    those are what the glasses sort by); a database missing what a role needs is hidden by
    default rather than offered as if it would work.

    Scenario: A same-named database with the wrong schema is hidden
      Given two shared databases are both called "Projects", but only one has the properties a
        Projects database needs
      Then only the one with the right properties appears in the Projects dropdown

    Scenario: A slot with exactly one fitting candidate is filled in automatically
      Given only one of the shared databases has the schema the Tags role needs
      When the databases finish loading
      Then the Tags slot is already filled with that database
      And I did not have to choose it myself

    Scenario: A slot with more than one fitting candidate is left for me to choose
      Given two shared databases both have the schema the Notes role needs
      When the databases finish loading
      Then the Notes slot is not filled in automatically

    Scenario: Filling one slot can free the next one to auto-fill
      Given one database fits both the Tasks and the Projects role's schema, and another database
        fits only the Projects role
      When the databases finish loading
      Then the shared-fit database is auto-assigned to Tasks
      And the Projects slot is then auto-filled with the other database

    Scenario: An already-chosen database is never silently replaced
      Given the Projects slot already holds a database that does not fit the Projects schema
      When the databases finish loading
      Then that choice is left exactly as it was
      And it is flagged with what it's missing

    Scenario: A hidden database is counted, not just dropped
      Given 3 of the shared databases don't fit the Projects role's schema
      Then the Projects dropdown shows a hint that 3 databases are hidden

    Scenario: All databases can be shown anyway
      Given some databases are hidden for not fitting a role
      When I turn on "Show all databases"
      Then every shared database is offered in every dropdown again

    Scenario: Choosing a database that doesn't fit warns instead of blocking
      Given I have chosen a database for Projects that is missing properties the role needs
      When I tap "Save"
      Then the form stays open
      And it explains that the database may show empty lists on the glasses
      And "Save" is not yet done

    Scenario: A second tap on Save goes through anyway
      Given the warning above is showing
      When I tap "Save" again
      Then the setup is saved with my choice, unfit or not
      # The requirement list is a guess about what a role needs — a customised Ultimate Brain
      # with a renamed property is a real possibility, so the form warns but never refuses.

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
