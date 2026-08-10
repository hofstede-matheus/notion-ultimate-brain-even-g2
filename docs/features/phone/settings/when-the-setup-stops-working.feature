@phone @settings @glasses
Feature: When a saved setup stops working

  A database chosen in settings can stop being usable later — someone unshared it, deleted it, or
  (see choosing-the-databases.feature) it never actually had the properties its role needs and
  that only shows up once a list is opened. The app doesn't wait for a launch to notice; it checks
  the first time a list actually fails to load in a way that looks like a configuration mistake,
  then sends me back to settings with the reason already on screen.

  Background:
    Given the app was set up earlier
    And the glasses are connected

  Scenario: A list that fails to load for a configuration reason triggers a check
    Given opening a list fails because the chosen database is missing a property its role needs
    When I open that list
    Then the glasses say setup needs attention and to continue on the phone
    And the phone's settings form opens on its own, with my previous choices still filled in
    And the database that no longer fits is flagged with what it's missing

  Scenario: Fixing the flagged database picks up where the list left off
    Given the phone opened settings on its own, as above
    When I choose a working database for the flagged slot
    And I tap "Save"
    Then the glasses return to the menu
    And the list that failed shows fresh data when I open it again

  Scenario: Backing out of the automatic prompt leaves the message up
    Given the phone opened settings on its own, as above
    When I back out without saving
    Then the glasses still say setup needs attention
    # Nothing is undone — the stored setup is exactly what it was before the check ran.

  Scenario: A plain network failure does not trigger this
    Given opening a list fails because the phone has no connection
    When I open that list
    Then the glasses say the list couldn't load and to check the phone
    But settings does not open on its own
    # Only a failure that looks configuration-shaped — not every failure — triggers a check.

  Scenario: The check runs at most once per session
    Given the automatic check already ran once during this session
    When another list fails for the same configuration reason
    Then settings does not open again on its own
    # Re-checking on every subsequent failure would mean a network hiccup right after the first
    # check keeps reopening settings. Reopening the app starts a new session.
